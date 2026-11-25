/**
 * Codes métier d'ÉcoleDirecte.
 *
 * Le service répond **HTTP 200 même quand il refuse** : le vrai statut est dans le champ
 * `code` du corps JSON. Traiter un 200 comme un succès est la première erreur que fait tout
 * client, et elle se paie en écrans vides inexplicables.
 */
export const ApiCode = {
  OK: 200,
  /** Question de sécurité exigée : nouvel appareil détecté. */
  TWO_FACTOR: 250,
  ACCESS_DENIED: 403,
  INVALID_CREDENTIALS: 505,
  /** Compte bloqué, ou établissement fermé (vacances). */
  BLOCKED: 516,
  /** Numéro de version `v=` périmé. Toute l'application tombe d'un coup. */
  STALE_VERSION: 517,
  TOKEN_EXPIRED: 520,
  TOKEN_INVALID: 525,
  /** Autre forme du jeton expiré, rencontrée par les clients qui tournent en réel. */
  TOKEN_EXPIRED_ALT: 526,
  BLOCKED_ALT: 535,
} as const

export type ApiErrorKind =
  | 'network'
  | 'session-expired'
  | 'invalid-credentials'
  | 'account-blocked'
  | 'access-denied'
  | 'stale-version'
  | 'two-factor'
  /** Le service demande de patienter (HTTP 429, ou 503 avec `Retry-After`). */
  | 'rate-limited'
  /** Accès refusé en amont du service (HTTP 403 sans corps JSON) : adresse non reconnue, VPN… */
  | 'ip-blocked'
  /** L'écriture a bien été construite mais volontairement pas envoyée. */
  | 'dry-run'
  /** L'écriture existe dans le code mais n'a pas encore passé son test réel. */
  | 'write-disabled'
  | 'protocol'

export interface ApiFailure {
  ok: false
  kind: ApiErrorKind
  message: string
  /** Détail technique, jamais montré tel quel et jamais porteur de secret. */
  diagnostic?: string
  /** Quand le service a dit combien patienter (`Retry-After`), en millisecondes. */
  retryAfterMs?: number
}

export type ApiResult<T> = { ok: true; value: T } | ApiFailure

export function failure(kind: ApiErrorKind, message: string, diagnostic?: string): ApiFailure {
  return diagnostic === undefined ? { ok: false, kind, message } : { ok: false, kind, message, diagnostic }
}

/** Le plafond d'une attente demandée : un `Retry-After` absurde ne doit pas geler le compte. */
export const RETRY_AFTER_MAX_MS = 6 * 60 * 60 * 1000

/** Lit `Retry-After` (secondes ou date HTTP). `undefined` si absent ou illisible. */
export function retryAfterMs(valeur: string | undefined, maintenant = Date.now()): number | undefined {
  if (!valeur) return undefined
  const texte = valeur.trim()
  const ms = /^\d+$/.test(texte) ? Number(texte) * 1000 : Date.parse(texte) - maintenant
  if (!Number.isFinite(ms)) return undefined
  return Math.min(Math.max(ms, 1000), RETRY_AFTER_MAX_MS)
}

/**
 * Ce que dit le **statut HTTP** quand le corps n'est pas la réponse JSON d'ÉcoleDirecte.
 *
 * Un refus en amont (pare-feu, limitation de débit, adresse jugée suspecte) arrive en HTML
 * ou vide, pas en JSON : le classer « le protocole a changé » envoyait chercher au mauvais
 * endroit et ne disait pas qu'il fallait **cesser d'insister**. `undefined` : rien à dire.
 */
export function failureForHttpStatus(
  status: number,
  retryAfter: string | undefined,
  maintenant = Date.now(),
): ApiFailure | undefined {
  const attente = retryAfterMs(retryAfter, maintenant)
  const avec = <T extends ApiFailure>(f: T): T => (attente === undefined ? f : { ...f, retryAfterMs: attente })
  if (status === 429 || (status === 503 && attente !== undefined)) {
    return avec(failure('rate-limited', 'ÉcoleDirecte demande de patienter avant de réessayer.', `statut ${status}`))
  }
  if (status === 403) {
    return avec(
      failure(
        'ip-blocked',
        "L'accès est refusé depuis cette adresse. Un VPN ou une adresse non reconnue en est souvent la cause.",
        'statut 403',
      ),
    )
  }
  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return failure('network', `Le service a répondu une erreur temporaire (HTTP ${status}).`, `statut ${status}`)
  }
  return undefined
}

/** Traduit un code métier en cause, avec le message que verra la personne. */
export function kindForCode(code: number): { kind: ApiErrorKind; message: string } {
  switch (code) {
    case ApiCode.TWO_FACTOR:
      return { kind: 'two-factor', message: 'Une question de sécurité est demandée.' }
    case ApiCode.ACCESS_DENIED:
      return { kind: 'access-denied', message: "Ce compte n'a pas accès à cette ressource." }
    case ApiCode.INVALID_CREDENTIALS:
      return { kind: 'invalid-credentials', message: 'Identifiant ou mot de passe incorrect.' }
    case ApiCode.BLOCKED:
    case ApiCode.BLOCKED_ALT:
      return { kind: 'account-blocked', message: 'Compte bloqué, ou établissement momentanément indisponible.' }
    case ApiCode.STALE_VERSION:
      return {
        kind: 'stale-version',
        message: "La version d'API utilisée n'est plus acceptée par ÉcoleDirecte.",
      }
    case ApiCode.TOKEN_EXPIRED:
    case ApiCode.TOKEN_INVALID:
    case ApiCode.TOKEN_EXPIRED_ALT:
      return { kind: 'session-expired', message: 'La session a expiré.' }
    default:
      return { kind: 'protocol', message: 'Réponse inattendue du service : le protocole a probablement changé.' }
  }
}
