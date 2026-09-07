import type { Handle } from '@sveltejs/kit'
import { readSession } from '$lib/server/session.js'

/**
 * Deux choses à chaque requête : retrouver la session, et poser des en-têtes de sécurité.
 *
 * La politique de contenu est stricte parce qu'elle le peut : l'application ne charge ni
 * script ni feuille de style d'ailleurs. Elle est la deuxième barrière derrière le cookie
 * `httpOnly` — la première étant que le jeton ne descend jamais jusqu'ici.
 */
export const handle: Handle = async ({ event, resolve }) => {
  const session = readSession(event.cookies)
  event.locals.sessionId = session?.id ?? null
  event.locals.session = session?.record ?? null

  const response = await resolve(event)
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      // Aucune requête sortante depuis la page : tout passe par nos routes.
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  )
  response.headers.set('Referrer-Policy', 'same-origin')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  return response
}
