export const COOKIE_CACHE = 'e2r-lecture'
export type Raison = 'network' | 'account-blocked' | 'stale-version' | 'unavailable'

/** Le réseau du navigateur et le réseau du mandataire sont deux pannes différentes. */
export function raisonRepli(enLigne: boolean, causes: readonly string[]): Raison | null {
  if (!enLigne) return 'network'
  if (causes.includes('account-blocked')) return 'account-blocked'
  if (causes.includes('stale-version')) return 'stale-version'
  return causes.length ? 'unavailable' : null
}

export const raisons = {
  network: { titre: 'Hors ligne', action: 'Vérifiez votre connexion, puis réessayez.' },
  'account-blocked': { titre: 'Compte verrouillé ou établissement fermé', action: 'Vérifiez votre accès sur ÉcoleDirecte ou contactez votre établissement.' },
  'stale-version': { titre: 'Version d’API refusée (517)', action: 'Signalez cette erreur à la personne qui héberge l’application.' },
  unavailable: { titre: 'ÉcoleDirecte indisponible', action: 'Réessayez dans quelques instants.' },
} as const

export function peutRafraichir(derniereLecture: number | null, maintenant: number): boolean {
  return derniereLecture === null || maintenant - derniereLecture >= 90_000
}

export function anciennete(date: number, maintenant: number): string {
  const minutes = Math.floor(Math.max(0, maintenant - date) / 60_000)
  const age = minutes < 1 ? 'à l’instant' : minutes < 60 ? `il y a ${minutes} min`
    : minutes < 1440 ? `il y a ${Math.floor(minutes / 60)} h` : `il y a ${Math.floor(minutes / 1440)} j`
  const jour = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short' }).format(date)
  const heure = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).format(date).replace(':00', ' h').replace(':', ' h ')
  return `Données du ${jour} à ${heure} (${age})`
}

/** Seul le paramètre de relecture disparaît : les filtres restent des pages distinctes. */
export function cleLecture(adresse: string): string {
  const url = new URL(adresse)
  url.searchParams.delete('rafraichir')
  url.searchParams.sort()
  return url.href
}

export function pageLisible(path: string): boolean {
  return !/^\/(connexion|deconnexion|piece-jointe)(\/|$)/.test(path)
}
