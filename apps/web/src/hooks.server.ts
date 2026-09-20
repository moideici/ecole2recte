import type { Handle } from '@sveltejs/kit'
import { readSession } from '$lib/server/session.js'
import { selectStore, withSessionStore } from '$lib/server/store.js'

/**
 * Deux choses à chaque requête : retrouver la session, et poser des en-têtes de sécurité.
 *
 * La politique de contenu est stricte parce qu'elle le peut : l'application ne charge ni
 * script ni feuille de style d'ailleurs. Elle est la deuxième barrière derrière le cookie
 * `httpOnly` — la première étant que le jeton ne descend jamais jusqu'ici.
 *
 * Le magasin de session est choisi une fois par requête — Durable Object sur Cloudflare,
 * mémoire sinon — puis rendu disponible à toute la chaîne (`load`, actions) sans qu'elle ait
 * à le savoir : voir `withSessionStore` dans `store.ts`.
 */
export const handle: Handle = async ({ event, resolve }) => {
  const store = selectStore(event.platform?.env?.SESSIONS)
  return withSessionStore(store, async () => {
    const session = await readSession(event.cookies, store)
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
  })
}
