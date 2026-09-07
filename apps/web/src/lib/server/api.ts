import { env } from '$env/dynamic/private'
import {
  type Account,
  type DataSection,
  type SchoolSnapshot,
  type SyncOutcome,
  EcoleDirecteApi,
  EcoleDirecteClient,
  emptySnapshot,
  fetchEngine,
  mergeSnapshot,
  syncSections,
} from '@ecole2recte/protocol'
import { type SessionRecord, sessions } from './store.js'
import { writePolicy } from './write-policy.js'

/**
 * Le mandataire.
 *
 * C'est ici, et nulle part ailleurs, que l'application parle à ÉcoleDirecte. Le navigateur
 * ne connaît que nos propres routes : il n'existe pas d'entrée « transmets ce que je te
 * donne », sans quoi on publierait un relais anonyme vers ÉcoleDirecte.
 */
export function clientFor(record: SessionRecord): { client: EcoleDirecteClient; api: EcoleDirecteApi } {
  const client = new EcoleDirecteClient({
    engine: fetchEngine(),
    session: record.protocol,
    writePolicy: writePolicy(),
    apiBase: env['ED_API_BASE'] ?? undefined,
    // Réglable sans redéployer : le jour où la version périme, tout tombe avec le code 517.
    ...(env['ED_API_VERSION'] ? {} : {}),
  })
  if (env['ED_API_VERSION']) client.session.apiVersion = env['ED_API_VERSION']
  return { client, api: new EcoleDirecteApi(client) }
}

/**
 * Rejoue l'état de session dans le magasin après un appel.
 *
 * Les jetons tournent à chaque requête : ne pas les réécrire revient à se déconnecter tout
 * seul au bout de quelques minutes.
 */
export function persist(id: string, record: SessionRecord): void {
  sessions.write(id, record)
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
  persist(id, record)
  return { snapshot, errors: outcome.errors, fromCache: false }
}

/** Oublie le cache d'un profil : après une écriture, ce qu'on affichait n'est plus vrai. */
export function invalidate(id: string, record: SessionRecord, accountId: string): void {
  delete record.snapshots[accountId]
  persist(id, record)
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
