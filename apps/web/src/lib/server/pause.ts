import type { ApiFailure } from '@ecole2recte/protocol'
import type { Cookies } from '@sveltejs/kit'

/**
 * Quand ÉcoleDirecte dit non, cesser d'insister.
 *
 * Presque tout ce qui prolonge un blocage est un client qui réessaie. Chaque refus a donc sa
 * réponse, et aucune n'est « recommencer tout de suite » :
 *
 *  - **mauvais identifiants** : on oublie tout et on déconnecte — rejouer un mot de passe
 *    faux est ce qui bloque un compte ;
 *  - **question de sécurité** : la connexion se met en **pause** jusqu'à ce que la personne se
 *    reconnecte à la main. Rien n'est deviné, rien n'est rejoué ;
 *  - **blocage, adresse refusée, demande de patienter** : un *disjoncteur*. Aucun appel ne
 *    part avant l'heure dite — ni connexion, ni réouverture silencieuse ;
 *  - **panne passagère** (réseau, 5xx) : seulement ici on réessaie, trois fois, espacées.
 *
 * Rien de tout cela ne cherche à lever un blocage : c'est le service qui le lève, ou la
 * personne en autorisant son adresse (ÉcoleDirecte envoie un e-mail pour cela).
 */

export type RaisonPause = 'attente' | 'blocage' | 'question'
export interface Pause {
  jusqua: number
  raison: RaisonPause
  /** Quand le refus est arrivé : sert à espacer les essais faits à la main. */
  depuis?: number
}

/** Après un refus d'adresse, un essai **à la main** redevient possible au bout d'une minute. */
export const ESSAI_MANUEL_MS = 60_000

/**
 * La personne peut-elle retenter elle-même ?
 *
 * La pause arrête les appels que l'application ferait **toute seule**. Elle ne doit pas
 * enfermer quelqu'un qui vient de couper son VPN : après un refus d'adresse, la cause a pu
 * disparaître, et seule la personne le sait. On lui laisse donc un essai par minute — assez
 * pour corriger, pas assez pour insister. Quand le service demande explicitement de patienter
 * (429, `Retry-After`), son délai reste respecté : c'est lui qui l'a dit.
 */
export function essaiManuelPermis(pause: Pause, maintenant = Date.now()): boolean {
  if (pause.raison === 'question') return true
  return pause.raison === 'blocage' && maintenant - (pause.depuis ?? 0) >= ESSAI_MANUEL_MS
}

const MINUTE = 60_000
/** Sans consigne du service, on attend un quart d'heure. */
export const ATTENTE_PAR_DEFAUT_MS = 15 * MINUTE
/** Un refus d'adresse ou un compte bloqué : une demi-heure avant de retoucher au service. */
export const BLOCAGE_PAR_DEFAUT_MS = 30 * MINUTE
/** La question de sécurité attend une reconnexion à la main, pas un délai. */
export const QUESTION_MS = 365 * 24 * 60 * MINUTE

export const COOKIE_PAUSE = 'e2r_pause'

/** La pause qui suit cet échec, ou `null` s'il n'y en a pas (identifiants refusés, panne passagère…). */
export function pauseApres(echec: ApiFailure, maintenant = Date.now()): Pause | null {
  switch (echec.kind) {
    case 'rate-limited':
      return { jusqua: maintenant + Math.max(echec.retryAfterMs ?? ATTENTE_PAR_DEFAUT_MS, MINUTE), raison: 'attente', depuis: maintenant }
    case 'ip-blocked':
    case 'account-blocked':
      return { jusqua: maintenant + Math.max(echec.retryAfterMs ?? BLOCAGE_PAR_DEFAUT_MS, MINUTE), raison: 'blocage', depuis: maintenant }
    case 'two-factor':
      return { jusqua: maintenant + QUESTION_MS, raison: 'question', depuis: maintenant }
    default:
      return null
  }
}

export function pauseActive(pause: Pause | null | undefined, maintenant = Date.now()): pause is Pause {
  return !!pause && pause.jusqua > maintenant
}

const heure = (t: number) =>
  new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

/** Le message que voit la personne : ce qui se passe, ce qu'elle peut faire, et à quelle heure réessayer. */
export function messagePause(pause: Pause): string {
  switch (pause.raison) {
    case 'question':
      return 'ÉcoleDirecte demande une vérification de sécurité. Reconnecte-toi une fois à la main pour la confirmer.'
    case 'blocage':
      return (
        `ÉcoleDirecte refuse l’accès depuis cette adresse. Un VPN qui change d’adresse en est la cause la plus ` +
        `fréquente : coupe-le pour ce site, ou garde toujours la même adresse, et regarde ta boîte mail — ` +
        `ÉcoleDirecte y envoie un message pour autoriser une adresse. Si tu viens de couper ton VPN ou de ` +
        `changer de réseau, tu peux réessayer toi-même au bout d’une minute ; la reconnexion automatique, elle, ` +
        `attend jusqu’à ${heure(pause.jusqua)}.`
      )
    case 'attente':
      return `ÉcoleDirecte demande de patienter. Nouvel essai possible vers ${heure(pause.jusqua)}.`
  }
}

/* ----- le cookie de pause : la page de connexion s'en sert pour ne pas retoucher au service ----- */

export function lirePause(cookies: Pick<Cookies, 'get'>, maintenant = Date.now()): Pause | null {
  const brut = cookies.get(COOKIE_PAUSE)
  const [jusqua, raison, depuis] = (brut ?? '').split('.')
  const t = Number(jusqua)
  if (!Number.isFinite(t) || !(raison === 'attente' || raison === 'blocage' || raison === 'question')) return null
  const quand = Number(depuis)
  const pause: Pause = { jusqua: t, raison, ...(depuis && Number.isFinite(quand) ? { depuis: quand } : {}) }
  return pauseActive(pause, maintenant) ? pause : null
}

/** La forme du cookie de pause, la même partout où on le pose. */
export function valeurCookiePause(pause: Pause): string {
  return `${pause.jusqua}.${pause.raison}${pause.depuis === undefined ? '' : `.${pause.depuis}`}`
}

export function poserPause(cookies: Pick<Cookies, 'set'>, pause: Pause, secure: boolean, maintenant = Date.now()): void {
  // « question » n'est pas lue par la page de connexion (la personne vient précisément la résoudre).
  if (pause.raison === 'question') return
  cookies.set(COOKIE_PAUSE, valeurCookiePause(pause), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: Math.max(1, Math.ceil((pause.jusqua - maintenant) / 1000)),
  })
}

/* ----- les réessais : seulement pour les pannes passagères ----- */

export const reessais = {
  /** Trois essais en tout. */
  max: 3,
  /** 0,8 s, puis 1,6 s : de quoi laisser passer une coupure, pas assez pour insister. */
  baseMs: 800,
  dormir: (ms: number): Promise<void> => new Promise((suite) => setTimeout(suite, ms)),
  /** De l'aléa pour que deux requêtes parties ensemble ne repartent pas ensemble. */
  alea: (): number => Math.random(),
}

/**
 * Rejoue `appel` **uniquement** si l'échec est une panne passagère (`network`). Un refus —
 * identifiants, blocage, question, patience demandée — ne se rejoue jamais.
 */
export async function avecReessais<T extends { ok: boolean }>(appel: () => Promise<T>): Promise<T> {
  let resultat = await appel()
  for (let essai = 1; essai < reessais.max; essai++) {
    const echec = resultat as unknown as { ok: false; kind?: string }
    if (resultat.ok || echec.kind !== 'network') break
    await reessais.dormir(reessais.baseMs * 2 ** (essai - 1) * (1 + reessais.alea() * 0.25))
    resultat = await appel()
  }
  return resultat
}
