import type { Handle } from '@sveltejs/kit'
import { clearSessionCookie, COOKIE_NAME, readSession, setSessionCookie } from '$lib/server/session.js'
import { enFile } from '$lib/server/file.js'
import { selectStore, withSessionStore } from '$lib/server/store.js'

/**
 * Trois choses à chaque requête : retrouver la session, la garder cohérente, et poser des
 * en-têtes de sécurité.
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
  const cookie = event.cookies.get(COOKIE_NAME)

  const traiter = () =>
    withSessionStore(store, async () => {
      const session = await readSession(event.cookies, store)
      event.locals.sessionId = session?.id ?? null
      event.locals.session = session?.record ?? null

      // Le cookie glisse avec la session : un « rester connecté » qui s'arrête à date fixe
      // n'en est pas un.
      if (session?.record.remembered) {
        setSessionCookie(event.cookies, session.id, event.url.protocol === 'https:', true)
      }

      let response = await resolve(event)

      // Session morte pour de bon (jeton périmé, rien de gardé pour la rouvrir) : on l'efface
      // et on renvoie à la connexion, plutôt que de laisser des sections en erreur.
      if (session?.record.expired) {
        await store.destroy(session.id)
        clearSessionCookie(event.cookies)
        response = new Response(null, { status: 303, headers: { location: '/connexion?expiree=1' } })
      }

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

  return cookie ? enFile(cookie, traiter) : traiter()
}
