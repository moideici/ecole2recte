import { env } from '$env/dynamic/private'
import {
  type Account,
  type ApiResult,
  type DataSection,
  type DayContent,
  type SchoolSnapshot,
  type SyncOutcome,
  EcoleDirecteApi,
  EcoleDirecteClient,
  TeacherApi,
  emptySnapshot,
  fetchEngine,
  mailboxId,
  mergeSnapshot,
  syncSections,
} from '@ecole2recte/protocol'
import { demoEngine } from './demo.js'
import { activeAccount } from './session.js'
import { type SessionRecord, sessions } from './store.js'
import { writePolicy } from './write-policy.js'

/** Le catalogue d'un professeur change rarement dans la journée. */
export const CATALOGUE_TTL_MS = 30 * 60 * 1000

/** La première page des messages reçus, telle que l'accueil du professeur la garde. */
export const CLE_MESSAGES_ACCUEIL = 'messages:received:0'

/**
 * Le mandataire.
 *
 * C'est ici, et nulle part ailleurs, que l'application parle à ÉcoleDirecte. Le navigateur
 * ne connaît que nos propres routes : il n'existe pas d'entrée « transmets ce que je te
 * donne », sans quoi on publierait un relais anonyme vers ÉcoleDirecte.
 */
export function clientFor(record: SessionRecord): { client: EcoleDirecteClient; api: EcoleDirecteApi } {
  const client = new EcoleDirecteClient({
    // Une session de démonstration ne sort jamais : son moteur est un faux serveur local.
    engine: record.demo ? demoEngine(today()) : fetchEngine(),
    session: record.protocol,
    writePolicy: record.demo ? 'deny' : writePolicy(),
    apiBase: env['ED_API_BASE'] ?? undefined,
  })
  // Réglable sans redéployer : le jour où la version périme, tout tombe avec le code 517.
  if (env['ED_API_VERSION']) client.session.apiVersion = env['ED_API_VERSION']

  /*
   * Le titulaire de la connexion, pour que le jeton puisse se renouveler seul.
   *
   * Le login le retient désormais, mais les sessions ouvertes avant ne l'ont pas : on le
   * retrouve ici plutôt que de les laisser sans renouvellement jusqu'à la prochaine
   * connexion. C'est le même identifiant que celui de la boîte aux lettres — pour un parent,
   * la famille, et non l'enfant consulté.
   */
  if (!client.session.userId) {
    const actif = activeAccount(record)
    if (actif) client.session.userId = mailboxId(actif)
  }
  return { client, api: new EcoleDirecteApi(client) }
}

/** Le même mandataire, côté enseignant : lecture seule, sur l'hôte enseignant. */
export function teacherFor(record: SessionRecord): { client: EcoleDirecteClient; api: TeacherApi } {
  const { client } = clientFor(record)
  return { client, api: new TeacherApi(client) }
}

/**
 * Rejoue l'état de session dans le magasin après un appel.
 *
 * Les jetons tournent à chaque requête : ne pas les réécrire revient à se déconnecter tout
 * seul au bout de quelques minutes.
 */
export async function persist(id: string, record: SessionRecord): Promise<void> {
  await sessions.write(id, record)
}

const SNAPSHOT_TTL_MS = 5 * 60 * 1000

export interface LoadedSnapshot {
  snapshot: SchoolSnapshot
  errors: SyncOutcome['errors']
  /** Vrai quand rien n'a été rechargé : l'instantané en cache était encore frais. */
  fromCache: boolean
}

/**
 * Charge les sections demandées, en s'appuyant sur le cache quand il est frais.
 *
 * Le cache est par profil et non global : changer d'enfant sur un compte parent ne doit pas
 * effacer ce qui a été chargé pour l'autre.
 */
export async function loadSections(
  id: string,
  record: SessionRecord,
  account: Account,
  sections: DataSection[],
  options: { today: string; force?: boolean } ,
): Promise<LoadedSnapshot> {
  const cached = record.snapshots[account.id]
  const base = cached?.snapshot ?? emptySnapshot(account)
  const missing = sections.filter((section) => base.syncedAt[section] === undefined)
  const stale = cached === undefined || Date.now() - cached.at > SNAPSHOT_TTL_MS

  if (!options.force && !stale && missing.length === 0) {
    return { snapshot: base, errors: {}, fromCache: true }
  }

  const wanted = options.force || stale ? sections : missing
  const { api } = clientFor(record)
  const outcome = await syncSections(api, account, { today: options.today, sections: wanted })
  const snapshot = mergeSnapshot(base, outcome)
  record.snapshots[account.id] = { snapshot, at: Date.now() }
  await persist(id, record)
  return { snapshot, errors: outcome.errors, fromCache: false }
}

/**
 * Une lecture gardée quelques minutes dans la session.
 *
 * Seules les réussites sont gardées : un échec doit pouvoir être retenté tout de suite. La
 * session est réécrite dans tous les cas, parce que les jetons ont tourné même sur un refus.
 */
export async function cached<T>(
  id: string,
  record: SessionRecord,
  key: string,
  load: () => Promise<ApiResult<T>>,
  ttl = SNAPSHOT_TTL_MS,
): Promise<ApiResult<T>> {
  const now = Date.now()
  const hit = record.cache?.[key]
  if (hit && now - hit.at < ttl) return { ok: true, value: hit.value as T }

  const result = await load()
  if (result.ok) {
    // Les entrées périmées partent au passage : une journée de consultation ne doit pas
    // faire gonfler la session sans fin.
    const kept = Object.entries(record.cache ?? {}).filter(([, entry]) => now - entry.at < ttl)
    record.cache = { ...Object.fromEntries(kept), [key]: { at: now, value: result.value } }
  }
  await persist(id, record)
  return result
}

/**
 * Le détail d'une journée du cahier de textes.
 *
 * Le résumé (`cahierdetexte.awp`) dit **quelles** matières ont du travail, mais pas lequel :
 * les énoncés et le contenu de séance n'arrivent qu'avec le détail d'un jour. Sans cet
 * appel, l'application affiche « Mathématiques, pour mardi » et rien d'autre — ce qui est
 * exactement l'information dont on n'a pas besoin.
 *
 * Les journées se chargent donc en parallèle, et chacune reste en cache : passer d'une fiche
 * à la liste et revenir ne redemande rien.
 */
export async function loadDays(
  id: string,
  record: SessionRecord,
  account: Account,
  dates: string[],
): Promise<Record<string, DayContent>> {
  const { api } = clientFor(record)
  const voulues = [...new Set(dates)].filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
  const jours: Record<string, DayContent> = {}

  await Promise.all(
    voulues.map(async (date) => {
      // Un jour illisible n'emporte pas les autres : au pire, sa fiche reste sans énoncé.
      const result = await cached(id, record, `jour:${account.id}:${date}`, () => api.dayContent(account, date))
      if (result.ok) jours[date] = result.value
    }),
  )
  return jours
}

/**
 * Oublie le cache d'un profil : après une écriture, ce qu'on affichait n'est plus vrai.
 *
 * Les journées du cahier de textes partent avec l'instantané. Les garder ferait réapparaître
 * un devoir décoché une seconde après l'avoir coché, et on croirait l'écriture cassée.
 */
export async function invalidate(id: string, record: SessionRecord, accountId: string): Promise<void> {
  delete record.snapshots[accountId]
  const prefixe = `jour:${accountId}:`
  for (const cle of Object.keys(record.cache ?? {})) {
    if (cle.startsWith(prefixe)) delete (record.cache as Record<string, unknown>)[cle]
  }
  await persist(id, record)
}

/**
 * La date du jour, telle que l'établissement la voit.
 *
 * Le serveur peut tourner à Francfort ou en Virginie ; l'élève, lui, est en France. Le
 * fuseau est donc fixé et réglable, jamais hérité de la machine.
 */
export function today(): string {
  const zone = env['ED_TIMEZONE'] ?? 'Europe/Paris'
  const formatter = new Intl.DateTimeFormat('fr-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' })
  return formatter.format(new Date())
}

export function nowLocal(): string {
  const zone = env['ED_TIMEZONE'] ?? 'Europe/Paris'
  const parts = new Intl.DateTimeFormat('fr-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`
}
