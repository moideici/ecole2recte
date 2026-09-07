import { headerValue } from './transport.js'

/**
 * L'état d'une session ÉcoleDirecte.
 *
 * Cet objet est **le secret** : il porte le jeton, et quiconque le détient est connecté. Il
 * ne descend jamais jusqu'au navigateur — il vit côté serveur, dans un cookie scellé ou un
 * magasin de sessions. Il est volontairement sérialisable en JSON, sans méthode ni classe,
 * pour pouvoir être scellé tel quel.
 */
export interface SessionState {
  gtk: string | null
  token: string | null
  twoFactorToken: string | null
  cookies: Record<string, string>
  /**
   * Épinglé pour la vie de la session : le jeton est lié au User-Agent qui l'a obtenu.
   * En changer l'invalide, ce qui produit une déconnexion que rien n'explique.
   */
  userAgent: string
  apiVersion: string
}

/** Le couple rendu par une question de sécurité réussie. Réutilisable, donc conservable. */
export interface TrustedAnswer {
  cn: string
  cv: string
}

export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'

/**
 * La version déclarée au service.
 *
 * Elle suit les mises à jour du site d'ÉcoleDirecte et **périme sans préavis** : le jour où
 * elle ne convient plus, toutes les requêtes échouent avec le code 517. Elle doit donc
 * pouvoir être changée sans redéployer — d'où la lecture d'une variable d'environnement.
 */
export const DEFAULT_API_VERSION = '4.75.0'

export function createSession(init: Partial<SessionState> = {}): SessionState {
  return {
    gtk: init.gtk ?? null,
    token: init.token ?? null,
    twoFactorToken: init.twoFactorToken ?? null,
    cookies: { ...(init.cookies ?? {}) },
    userAgent: init.userAgent ?? DEFAULT_USER_AGENT,
    apiVersion: init.apiVersion ?? DEFAULT_API_VERSION,
  }
}

const COOKIE_ATTRIBUTES = new Set([
  'path',
  'domain',
  'expires',
  'max-age',
  'samesite',
  'version',
  'comment',
  'secure',
  'httponly',
  'partitioned',
  'priority',
])

/** Range les `Set-Cookie` d'une réponse, en ignorant les attributs qui ne sont pas des cookies. */
export function applySetCookie(session: SessionState, values: string[]): void {
  for (const raw of values) {
    for (const piece of raw.split(';')) {
      const separator = piece.indexOf('=')
      if (separator <= 0) continue
      const name = piece.slice(0, separator).trim()
      const value = piece.slice(separator + 1).trim()
      if (name === '' || COOKIE_ATTRIBUTES.has(name.toLowerCase())) continue
      session.cookies[name] = value
    }
  }
}

export function cookieHeader(session: SessionState): string | null {
  const entries = Object.entries(session.cookies)
  if (entries.length === 0) return null
  return entries.map(([name, value]) => `${name}=${value}`).join('; ')
}

/**
 * Recueille ce qu'une réponse rapporte : les jetons tournent à chaque appel, et ne pas les
 * reprendre au vol revient à se déconnecter tout seul au bout de quelques minutes.
 */
export function absorb(session: SessionState, headers: Record<string, string[]>): void {
  const gtk = headerValue(headers, 'x-gtk')
  if (gtk) session.gtk = gtk
  const token = headerValue(headers, 'x-token')
  if (token) session.token = token
  const twoFactor = headerValue(headers, '2fa-token')
  if (twoFactor) session.twoFactorToken = twoFactor
  const cookies = headers['set-cookie']
  if (cookies) applySetCookie(session, cookies)
}

/** Ce qui peut être journalisé sans livrer la session. */
export function redacted(session: SessionState): Record<string, unknown> {
  return {
    gtk: session.gtk ? `<${session.gtk.length} caractères>` : null,
    token: session.token ? `<${session.token.length} caractères>` : null,
    twoFactorToken: session.twoFactorToken ? '<présent>' : null,
    cookies: Object.keys(session.cookies),
    apiVersion: session.apiVersion,
  }
}
