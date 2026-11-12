import type { Handle } from '@sveltejs/kit'
import { activeAccount, COOKIE_NAME, readSession, setSessionCookie } from '$lib/server/session.js'
import { COOKIE_APPAREIL, rouvrirDepuisCoffre } from '$lib/server/appareil.js'
import { ajouterAuJournal } from '$lib/server/journal.js'
import { enFile } from '$lib/server/file.js'
import { selectStore, ttlFor, withSessionStore } from '$lib/server/store.js'
import { createHash } from 'node:crypto'
import { lecture } from '$lib/server/lecture.js'
import { COOKIE_CACHE, pageLisible, raisonRepli } from '$lib/horsLigne.js'

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

/**
 * Une requête qui a besoin d'une session — une page ou ses données — et non un fichier
 * statique : seules celles-là justifient de rouvrir une session perdue. Rouvrir sur chaque
 * image ou chaque script serait une rafale de plus.
 */
function demandeUneSession(event: Parameters<Handle>[0]['event']): boolean {
  if (event.request.method !== 'GET') return false
  const chemin = event.url.pathname
  if (/^\/(_app|service-worker|manifest|icone|deconnexion)/.test(chemin)) return false
  return (event.request.headers.get('accept') ?? '').includes('text/html') || chemin.endsWith('/__data.json')
}

export const handle: Handle = async ({ event, resolve }) => {
  const store = selectStore(event.platform?.env?.SESSIONS)
  const cookie = event.cookies.get(COOKIE_NAME)
  // Sans session mais avec un coffre d'appareil, la file se fait sur le coffre : les requêtes
  // d'une même page ne doivent pas rouvrir chacune leur session.
  const cle = cookie ?? event.cookies.get(COOKIE_APPAREIL)

  const traiter = () =>
    withSessionStore(store, async () => {
      let session = await readSession(event.cookies, store)
      // Session perdue (expiration, redéploiement, cookie périmé) mais appareil reconnu : on la
      // rouvre sans rien demander. La page de connexion n'est plus que le dernier recours.
      if (!session && demandeUneSession(event)) session = await rouvrirDepuisCoffre(event.cookies, event.url)
      const debutDeLecture = Date.now()
      event.locals.sessionId = session?.id ?? null
      event.locals.session = session?.record ?? null

      // Le cookie glisse avec la session : un « rester connecté » qui s'arrête à date fixe
      // n'en est pas un.
      if (session?.record.remembered) {
        setSessionCookie(event.cookies, session.id, event.url.protocol === 'https:', true)
      }

      const lectures = { causes: [] as string[], dates: [] as number[] }
      let response = await lecture.run(lectures, () => resolve(event, {
        transformPageChunk: ({ html, done }) => done ? html.replace('</body>', `<script>window.__e2rLecture=${JSON.stringify({
          date: lectures.dates.length ? Math.min(...lectures.dates) : Date.now(),
          lecture: Date.now(),
          raison: raisonRepli(true, lectures.causes),
        })}</script></body>`) : html,
      }))

      // Le journal des chargements : la forme, jamais une valeur.
      if (session && !session.record.expired && demandeUneSession(event) && pageLisible(event.url.pathname)) {
        const raison = raisonRepli(true, lectures.causes)
        ajouterAuJournal(session.record, {
          at: debutDeLecture,
          ms: Date.now() - debutDeLecture,
          page: event.url.pathname,
          resultat: response.status >= 500 ? 'erreur' : raison ? 'repli' : 'ok',
        })
        await store.write(session.id, session.record)
      }

      // Session morte pour de bon (jeton périmé, rien de gardé pour la rouvrir) : on l'efface
      // et on renvoie à la connexion, plutôt que de laisser des sections en erreur.
      if (session?.record.expired) {
        await store.destroy(session.id)
        response = new Response(null, { status: 303, headers: { location: '/connexion?expiree=1' } })
        response.headers.append('Set-Cookie', event.cookies.serialize(COOKIE_NAME, '', { path: '/', maxAge: 0 }))
      }

      const compte = session && activeAccount(session.record)
      if (session && compte && !session.record.expired && pageLisible(event.url.pathname)) {
        // Ce marqueur ne permet aucune authentification et ne révèle pas le cookie secret.
        const scope = createHash('sha256').update(`${session.id}:${compte.id}`).digest('hex')
        const expiration = (session.record.remembered ? Date.now() : session.record.createdAt) + ttlFor(session.record)
        // Après resolve, SvelteKit a fermé cookies.set : on complète les en-têtes rendus.
        response.headers.append('Set-Cookie', event.cookies.serialize(COOKIE_CACHE, scope, { path: '/', httpOnly: false, sameSite: 'strict', secure: event.url.protocol === 'https:', maxAge: Math.max(0, Math.floor((expiration - Date.now()) / 1000)) }))
        response.headers.set('X-E2R-Scope', scope)
        response.headers.set('X-E2R-Expires', String(expiration))
        response.headers.set('X-E2R-Date', String(lectures.dates.length ? Math.min(...lectures.dates) : Date.now()))
        response.headers.set('X-E2R-Lecture', String(Date.now()))
        const raison = raisonRepli(true, lectures.causes)
        if (raison) response.headers.set('X-E2R-Repli', raison)
      } else if (!session || !compte || session.record.expired || /^\/(connexion|deconnexion)(\/|$)/.test(event.url.pathname)) {
        response.headers.append('Set-Cookie', event.cookies.serialize(COOKIE_CACHE, '', { path: '/', maxAge: 0 }))
      }
      // Les réponses privées ne doivent pas être réutilisées par le cache HTTP partagé.
      response.headers.set('Cache-Control', 'private, no-store')

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

  return cle ? enFile(cle, traiter) : traiter()
}
