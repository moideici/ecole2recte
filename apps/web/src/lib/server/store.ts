import { AsyncLocalStorage } from 'node:async_hooks'
import { randomBytes } from 'node:crypto'
import type { Account, SchoolSnapshot, SessionState, TrustedAnswer } from '@ecole2recte/protocol'

/**
 * Le magasin de sessions.
 *
 * **Pourquoi pas un cookie scellé ?** Le `X-Token` d'ÉcoleDirecte dépasse trois mille
 * caractères ; avec les comptes et le couple de confiance, la session ne tient pas dans les
 * quatre kilo-octets d'un cookie. Le navigateur ne reçoit donc qu'un identifiant opaque, et
 * le secret ne quitte jamais le serveur — ce qui vaut mieux de toute façon.
 *
 * **Deux implémentations.** En développement, ou sur un déploiement Node classique, une
 * simple `Map` en mémoire suffit — voir `MemorySessionStore`. Sur Cloudflare Workers, il n'y
 * a pas de process persistant : chaque requête peut atterrir sur une isolate différente. La
 * session vit alors dans un Durable Object (`DurableSessionStore`), un par identifiant de
 * session, choisi automatiquement quand le lien `SESSIONS` est présent — voir
 * `apps/sessions/`.
 */
export interface SessionRecord {
  /** L'état protocolaire : jetons, cookies, User-Agent épinglé. Le secret. */
  protocol: SessionState
  /** Les profils lisibles par cette connexion. Pour un parent, un par enfant. */
  accounts: Account[]
  /** Le profil consulté. */
  activeAccountId: string | null
  /** Le couple `cn`/`cv` validé, réutilisable pour ne pas reposer la question. */
  trusted?: TrustedAnswer
  /** La connexion est en attente d'une réponse à la question de sécurité. */
  awaitingSecurityAnswer: boolean
  /**
   * Les identifiants, **uniquement** pendant l'échange de question de sécurité.
   *
   * Finir la connexion exige de rejouer le login avec le couple de confiance, donc avec le
   * mot de passe. Il reste en mémoire du serveur le temps de l'échange — quelques secondes —
   * et il est effacé dès la validation. Il n'est jamais écrit sur disque, jamais journalisé,
   * et n'existe pas une fois la session ouverte.
   */
  pending?: { identifier: string; password: string; remember?: boolean }
  /**
   * Les identifiants **scellés**, quand la personne a demandé à rester connectée.
   *
   * Ils servent à rouvrir la session quand le jeton meurt, sans rien redemander. Chiffrés
   * par `SESSION_SECRET` (AES-256-GCM), ils ne quittent jamais le magasin : ni cookie, ni
   * journal, ni réponse. Se déconnecter détruit l'enregistrement, donc eux avec.
   *
   * Voir `reconnexion.ts` — c'est là que sont les garde-fous, et ils ne sont pas décoratifs.
   */
  remembered?: string
  /** Quand et combien de fois la session a été rouverte. Le garde-fou contre la rafale. */
  reauth?: { at: number; count: number }
  snapshots: Record<string, { snapshot: SchoolSnapshot; at: number }>
  /**
   * Les lectures de l'espace professeur, par clé d'appel. Un enseignant qui passe d'une classe
   * à l'autre ne doit pas recharger ce qu'il vient de consulter.
   */
  cache?: Record<string, { at: number; value: unknown }>
  /**
   * La session est morte pour de bon : jeton périmé, et rien de gardé pour la rouvrir (ou ce
   * qui l'était vient d'être refusé). Posé par `api.ts`, lu par `hooks.server.ts`, qui efface
   * la session et renvoie à la connexion au lieu de laisser des pages d'erreurs.
   */
  expired?: boolean
  /** Session de démonstration : aucune requête ne part vers ÉcoleDirecte. */
  demo?: boolean
  createdAt: number
  touchedAt: number
}

export interface SessionStore {
  create(record: Omit<SessionRecord, 'createdAt' | 'touchedAt'>): Promise<string>
  read(id: string): Promise<SessionRecord | null>
  write(id: string, record: SessionRecord): Promise<void>
  destroy(id: string): Promise<void>
}

/** Douze heures : au-delà, le jeton ÉcoleDirecte a de toute façon toutes les chances d'être mort. */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000

/**
 * Trente jours, pour une session « rester connecté ».
 *
 * Douze heures suffisaient à tuer la fonction : la session (cookie, magasin, Durable Object)
 * disparaissait avec les identifiants scellés qu'elle portait, avant qu'on ait pu s'en servir
 * le lendemain. Le délai glisse : chaque écriture le repousse.
 */
export const SESSION_LONGUE_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** La durée de vie qui convient à cette session. */
export function ttlFor(record: Pick<SessionRecord, 'remembered'>): number {
  return record.remembered ? SESSION_LONGUE_TTL_MS : SESSION_TTL_MS
}

/** 32 octets d'aléa : l'identifiant est la seule chose que le navigateur détient. */
function newSessionId(): string {
  return randomBytes(32).toString('base64url')
}

class MemorySessionStore implements SessionStore {
  private readonly records = new Map<string, SessionRecord>()

  async create(record: Omit<SessionRecord, 'createdAt' | 'touchedAt'>): Promise<string> {
    this.sweep()
    const id = newSessionId()
    const now = Date.now()
    this.records.set(id, { ...record, createdAt: now, touchedAt: now })
    return id
  }

  async read(id: string): Promise<SessionRecord | null> {
    const record = this.records.get(id)
    if (!record) return null
    if (Date.now() - record.touchedAt > ttlFor(record)) {
      this.records.delete(id)
      return null
    }
    return record
  }

  async write(id: string, record: SessionRecord): Promise<void> {
    if (!this.records.has(id)) return
    this.records.set(id, { ...record, touchedAt: Date.now() })
  }

  async destroy(id: string): Promise<void> {
    this.records.delete(id)
  }

  private sweep(): void {
    const now = Date.now()
    for (const [id, record] of this.records) {
      if (now - record.touchedAt > ttlFor(record)) this.records.delete(id)
    }
  }
}

/**
 * Espace de bindings minimal attendu de Cloudflare : juste de quoi joindre le Durable Object
 * des sessions, sans dépendre de `@cloudflare/workers-types` ici.
 */
export interface SessionNamespace {
  idFromName(name: string): { toString(): string }
  get(id: { toString(): string }): { fetch(input: string, init?: RequestInit): Promise<Response> }
}

const fallback: SessionStore = new MemorySessionStore()

/**
 * Le magasin de sessions côté Cloudflare : un Durable Object par session, hébergé par le
 * worker `apps/sessions` (voir ce dossier). Il ne fait qu'un aller-retour HTTP interne — le
 * Durable Object garde la vraie mémoire, et reste le seul foyer de vérité quelle que soit
 * l'isolate qui reçoit la requête.
 *
 * **Repli silencieux.** Le lien `SESSIONS` existe dès que `wrangler.toml` le déclare — y
 * compris sous `pnpm dev` (simple `vite dev`), où le worker `apps/sessions` ne tourne pas à
 * côté. Un aller-retour qui échoue bascule donc sur la mémoire du process plutôt que de faire
 * tomber la page : le développement local reste possible sans rien déployer.
 */
class DurableSessionStore implements SessionStore {
  constructor(
    private readonly namespace: SessionNamespace,
    private readonly fallback: SessionStore,
  ) {}

  private async request(id: string, path: string, init?: RequestInit): Promise<Response> {
    const stub = this.namespace.get(this.namespace.idFromName(id))
    const response = await stub.fetch(`https://session/${path}`, init)
    if (!response.ok && response.status !== 404) {
      throw new Error(`Durable Object des sessions indisponible (${response.status}).`)
    }
    return response
  }

  async create(record: Omit<SessionRecord, 'createdAt' | 'touchedAt'>): Promise<string> {
    try {
      const id = newSessionId()
      const now = Date.now()
      await this.request(id, 'write', {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-session-ttl': String(ttlFor(record)) },
        body: JSON.stringify({ ...record, createdAt: now, touchedAt: now }),
      })
      return id
    } catch {
      return this.fallback.create(record)
    }
  }

  async read(id: string): Promise<SessionRecord | null> {
    try {
      const response = await this.request(id, 'read')
      if (response.status === 404) return null
      return (await response.json()) as SessionRecord
    } catch {
      return this.fallback.read(id)
    }
  }

  async write(id: string, record: SessionRecord): Promise<void> {
    try {
      await this.request(id, 'write', {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-session-ttl': String(ttlFor(record)) },
        body: JSON.stringify({ ...record, touchedAt: Date.now() }),
      })
    } catch {
      await this.fallback.write(id, record)
    }
  }

  async destroy(id: string): Promise<void> {
    try {
      await this.request(id, 'destroy', { method: 'DELETE' })
    } catch {
      await this.fallback.destroy(id)
    }
  }
}

/** Choisit le magasin pour la requête en cours : Durable Object si le lien existe, mémoire sinon. */
export function selectStore(namespace: SessionNamespace | undefined | null): SessionStore {
  return namespace ? new DurableSessionStore(namespace, fallback) : fallback
}

const context = new AsyncLocalStorage<SessionStore>()

/** Rend `store` actif pour toute la durée de `run`, y compris à travers les `await`. */
export function withSessionStore<T>(store: SessionStore, run: () => Promise<T>): Promise<T> {
  return context.run(store, run)
}

function current(): SessionStore {
  return context.getStore() ?? fallback
}

/**
 * Le magasin actif de la requête en cours. `hooks.server.ts` choisit l'implémentation ; tout
 * le reste de l'application — `persist`, `invalidate`, les actions de connexion — s'en sert
 * sans savoir laquelle tourne dessous.
 */
export const sessions: SessionStore = {
  create: (record) => current().create(record),
  read: (id) => current().read(id),
  write: (id, record) => current().write(id, record),
  destroy: (id) => current().destroy(id),
}
