/// <reference lib="webworker" />
import { build, files, version } from '$service-worker'
import { COOKIE_CACHE, cleLecture, pageLisible } from './lib/horsLigne.js'

const sw = self as unknown as ServiceWorkerGlobalScope
const SHELL = `e2r-shell-${version}`
const PREFIX = 'e2r-pages-'
const actifs = new Set([...build, ...files])
let generation = 0

async function vider(): Promise<void> {
  generation++
  await Promise.all((await caches.keys()).filter((nom) => nom.startsWith(PREFIX)).map((nom) => caches.delete(nom)))
}

sw.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll([...actifs])))
})
sw.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Les anciennes pages référencent les anciens fichiers compilés du shell.
    await vider()
    await Promise.all((await caches.keys()).filter((nom) => nom.startsWith('e2r-shell-') && nom !== SHELL).map((nom) => caches.delete(nom)))
    await sw.clients.claim()
  })())
})
sw.addEventListener('message', (event) => {
  if (event.data?.type === 'e2r-effacer') event.waitUntil(vider())
})

async function scopeClient(id: string): Promise<string | null> {
  const client = id && await sw.clients.get(id)
  if (!client) return null
  return new Promise((resolve) => {
    const canal = new MessageChannel()
    const timer = setTimeout(() => { canal.port1.close(); resolve(null) }, 1000)
    canal.port1.onmessage = (event) => {
      clearTimeout(timer)
      canal.port1.close()
      resolve(typeof event.data === 'string' && /^[a-f0-9]{64}$/.test(event.data) ? event.data : null)
    }
    client.postMessage({ type: 'e2r-scope' }, [canal.port2])
  })
}

async function informer(id: string, response: Response, raison: string | null): Promise<void> {
  const client = id && await sw.clients.get(id)
  if (client) client.postMessage({ type: 'e2r-lecture', date: Number(response.headers.get('X-E2R-Date')), lecture: Number(response.headers.get('X-E2R-Lecture')), raison })
}

/** Un document neuf doit lire son cookie avant de demander la moindre donnée privée. */
function documentRepli(raison: string): Response {
  const script = `(async()=>{try{const scope=document.cookie.split('; ').find(c=>c.startsWith('${COOKIE_CACHE}='))?.slice(${COOKIE_CACHE.length + 1});if(!scope)throw Error();const r=await fetch(location.href,{headers:{'X-E2R-Offline':scope,'X-E2R-Reason':${JSON.stringify(raison)}}});if(!r.ok)throw Error();const html=await r.text();document.open();document.write(html);document.close()}catch{document.open();document.write('<html lang="fr"><meta charset="utf-8"><p>Cette lecture hors ligne n’est plus disponible. Reconnectez-vous pour continuer.</p><a href="/connexion">Se connecter</a></html>');document.close()}})()`
  return new Response(`<!doctype html><html lang="fr"><meta charset="utf-8"><script>${script}</script></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
}

async function lireDocument(scope: string, url: string, raison: string): Promise<Response> {
  const nom = PREFIX + scope
  const response = /^[a-f0-9]{64}$/.test(scope) && (await caches.keys()).includes(nom)
    ? await (await caches.open(nom)).match(cleLecture(url)) : undefined
  if (!response || Number(response.headers.get('X-E2R-Expires')) <= Date.now()) return new Response(null, { status: 503 })
  const etat = { date: Number(response.headers.get('X-E2R-Date')), lecture: Number(response.headers.get('X-E2R-Lecture')), raison: ['network', 'account-blocked', 'stale-version', 'unavailable'].includes(raison) ? raison : 'network' }
  const html = (await response.text()).replace('</body>', `<script>window.__e2rLecture=${JSON.stringify(etat)}</script></body>`)
  const headers = new Headers(response.headers)
  headers.delete('Content-Length')
  headers.delete('Content-Encoding')
  return new Response(html, { headers })
}

sw.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (url.origin !== sw.location.origin) return
  if (actifs.has(url.pathname) && event.request.method === 'GET') {
    event.respondWith(caches.open(SHELL).then(async (cache) => (await cache.match(event.request)) ?? fetch(event.request)))
    return
  }
  if (event.request.method !== 'GET') {
    event.respondWith((async () => {
      // Même une déconnexion sans réseau oublie les lectures avant de tenter le serveur.
      await vider()
      try { return await fetch(event.request) } catch {
        const message = 'Hors ligne : cette action n’a pas été envoyée. Aucune écriture n’est mise en attente.'
        if (event.request.headers.get('x-sveltekit-action') === 'true') {
          return new Response(JSON.stringify({ type: 'error', status: 503, error: { message } }), { status: 503, headers: { 'Content-Type': 'application/json' } })
        }
        return new Response(`<html lang="fr"><meta charset="utf-8"><p>${message}</p><a href="/">Revenir à l’accueil</a></html>`, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
      }
    })())
    return
  }
  if (!pageLisible(url.pathname)) {
    if (url.pathname.startsWith('/connexion')) event.respondWith(vider().then(() => fetch(event.request)))
    return
  }
  const demande = event.request.headers.get('X-E2R-Offline')
  if (demande) {
    event.respondWith(lireDocument(demande, url.href, event.request.headers.get('X-E2R-Reason') ?? 'network'))
    return
  }
  const document = event.request.mode === 'navigate'
  if (!document && !url.pathname.endsWith('/__data.json')) return
  event.respondWith((async () => {
    const debut = generation
    const cle = cleLecture(url.href)
    const scope = await scopeClient(event.clientId)
    const noms = (await caches.keys()).filter((nom) => nom.startsWith(PREFIX))
    const nom = scope ? PREFIX + scope : undefined
    const cache = nom ? await caches.open(nom) : null
    const ancien = await cache?.match(cle)
    const valide = ancien && Number(ancien.headers.get('X-E2R-Expires')) > Date.now() ? ancien : null
    let response: Response
    try { response = await fetch(event.request) } catch {
      if (document) return documentRepli('network')
      if (!valide || debut !== generation) throw new Error('Aucune lecture hors ligne pour cette session.')
      await informer(event.clientId, valide, 'network')
      return valide
    }
    const identite = response.headers.get('X-E2R-Scope')
    if (!identite || response.redirected || !response.ok) {
      if (!identite || response.redirected) await vider()
      return response
    }
    const raison = response.headers.get('X-E2R-Repli')
    if (raison) {
      if (document && debut === generation) {
        const precedent = await (await caches.open(PREFIX + identite)).match(cle)
        if (precedent && Number(precedent.headers.get('X-E2R-Expires')) > Date.now()) return documentRepli(raison)
      }
      if (valide && identite === valide.headers.get('X-E2R-Scope') && debut === generation) {
        await informer(event.clientId, valide, raison)
        return valide
      }
      await informer(event.clientId, response, raison)
      return response
    }
    if (debut === generation) {
      for (const autre of noms) if (autre !== PREFIX + identite) await caches.delete(autre)
      try {
        await (await caches.open(PREFIX + identite)).put(cle, response.clone())
      } catch {
        // Un quota local dépassé ne doit pas empêcher de lire une réponse réseau valide.
      }
    }
    await informer(event.clientId, response, null)
    return response
  })())
})
