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
 * **Ce que cette implémentation ne fait pas.** Elle garde tout en mémoire : un redémarrage
 * déconnecte, et deux instances derrière un répartiteur ne se voient pas. C'est suffisant
 * pour un déploiement à une instance, et l'interface est là pour qu'un magasin partagé
 * (Redis, base) prenne sa place sans toucher au reste.
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
  pending?: { identifier: string; password: string }
  snapshots: Record<string, { snapshot: SchoolSnapshot; at: number }>
  /**
   * Les lectures de l'espace professeur, par clé d'appel. Un enseignant qui passe d'une classe
   * à l'autre ne doit pas recharger ce qu'il vient de consulter.
   */
  cache?: Record<string, { at: number; value: unknown }>
  /** Session de démonstration : aucune requête ne part vers ÉcoleDirecte. */
  demo?: boolean
  createdAt: number
  touchedAt: number
}

export interface SessionStore {
  create(record: Omit<SessionRecord, 'createdAt' | 'touchedAt'>): string
  read(id: string): SessionRecord | null
  write(id: string, record: SessionRecord): void
  destroy(id: string): void
}

/** Douze heures : au-delà, le jeton ÉcoleDirecte a de toute façon toutes les chances d'être mort. */
const TTL_MS = 12 * 60 * 60 * 1000

class MemorySessionStore implements SessionStore {
  private readonly records = new Map<string, SessionRecord>()

  create(record: Omit<SessionRecord, 'createdAt' | 'touchedAt'>): string {
    this.sweep()
    // 32 octets d'aléa : l'identifiant est la seule chose que le navigateur détient.
    const id = randomBytes(32).toString('base64url')
    const now = Date.now()
    this.records.set(id, { ...record, createdAt: now, touchedAt: now })
    return id
  }

  read(id: string): SessionRecord | null {
    const record = this.records.get(id)
    if (!record) return null
    if (Date.now() - record.touchedAt > TTL_MS) {
      this.records.delete(id)
      return null
    }
    return record
  }

  write(id: string, record: SessionRecord): void {
    if (!this.records.has(id)) return
    this.records.set(id, { ...record, touchedAt: Date.now() })
  }

  destroy(id: string): void {
    this.records.delete(id)
  }

  private sweep(): void {
    const limit = Date.now() - TTL_MS
    for (const [id, record] of this.records) {
      if (record.touchedAt < limit) this.records.delete(id)
    }
  }
}

export const sessions: SessionStore = new MemorySessionStore()
