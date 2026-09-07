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
}

export type ApiResult<T> = { ok: true; value: T } | ApiFailure

export function failure(kind: ApiErrorKind, message: string, diagnostic?: string): ApiFailure {
  return diagnostic === undefined ? { ok: false, kind, message } : { ok: false, kind, message, diagnostic }
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
      return { kind: 'session-expired', message: 'La session a expiré.' }
    default:
      return { kind: 'protocol', message: 'Réponse inattendue du service : le protocole a probablement changé.' }
  }
}
