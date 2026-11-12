import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { MessageChannel } from 'node:worker_threads'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'
import { COOKIE_CACHE, cleLecture, pageLisible } from './horsLigne.js'

const A = 'a'.repeat(64)
const B = 'b'.repeat(64)

/** Un faux navigateur rejoue le vrai gestionnaire, sans réseau ni données personnelles. */
function navigateur() {
  const gestionnaires: Record<string, (event: unknown) => void> = {}
  const magasins = new Map<string, Map<string, Response>>()
  const messages: Array<{ raison: string | null }> = []
  let scope: string | null = A
  const fetch = vi.fn(async (_request: Request): Promise<Response> => reponse('Lecture initiale'))
  const caches = {
    keys: async () => [...magasins.keys()],
    delete: async (nom: string) => magasins.delete(nom),
    open: async (nom: string) => {
      if (!magasins.has(nom)) magasins.set(nom, new Map())
      const magasin = magasins.get(nom)!
      return {
        match: async (cle: string) => magasin.get(cle)?.clone(),
        put: async (cle: string, valeur: Response) => { magasin.set(cle, valeur.clone()) },
        addAll: async () => {},
      }
    },
  }
  const self = {
    location: { origin: 'https://ecole.test' },
    addEventListener: (type: string, fn: (event: unknown) => void) => { gestionnaires[type] = fn },
    clients: {
      claim: async () => {},
      get: async () => ({ postMessage: (message: { type: string; raison: string | null }, ports?: MessagePort[]) => {
        if (message.type === 'e2r-scope') { ports?.[0]?.postMessage(scope); ports?.[0]?.close() }
        else messages.push(message)
      } }),
    },
  }
  const source = readFileSync(new URL('../service-worker.ts', import.meta.url), 'utf8').replace(/^import .*$/gm, '')
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace(/^export \{\};?$/gm, '')
  runInNewContext(code, { self, caches, fetch, URL, Response, Headers, MessageChannel, setTimeout, clearTimeout, Date, COOKIE_CACHE, cleLecture, pageLisible, build: ['/app.js'], files: [], version: 'test' })
  return {
    fetch, magasins, messages,
    changerScope: (valeur: string | null) => { scope = valeur },
    async requete(path = '/notes', options: { document?: boolean; method?: string; headers?: Record<string, string> } = {}) {
      let resultat: Promise<Response> | undefined
      gestionnaires.fetch!({
        clientId: 'onglet',
        request: { url: `https://ecole.test${path}`, method: options.method ?? 'GET', mode: options.document ? 'navigate' : 'same-origin', headers: new Headers(options.headers) },
        respondWith: (response: Promise<Response>) => { resultat = response },
      })
      return resultat ? await resultat : null
    },
    async effacer() {
      let resultat: Promise<void> | undefined
      gestionnaires.message!({ data: { type: 'e2r-effacer' }, waitUntil: (promesse: Promise<void>) => { resultat = promesse } })
      await resultat
    },
  }
}

function reponse(contenu: string, scope = A, raison?: string, expiration = Date.now() + 3600_000) {
  const headers = new Headers({ 'Content-Type': 'text/html', 'X-E2R-Scope': scope, 'X-E2R-Date': String(Date.now() - 180_000), 'X-E2R-Expires': String(expiration) })
  if (raison) headers.set('X-E2R-Repli', raison)
  return new Response(`<html><head></head><body>${contenu}</body></html>`, { headers })
}

describe('service worker hors ligne', () => {
  it('rend la dernière lecture valide et sa vraie date lorsque le réseau tombe', async () => {
    const nav = navigateur()
    await nav.requete('/notes/__data.json')
    nav.fetch.mockRejectedValue(new Error('Pas de réseau'))
    const response = await nav.requete('/notes/__data.json?rafraichir=1')
    expect(await response?.text()).toContain('Lecture initiale')
    expect(Number(response?.headers.get('X-E2R-Date'))).toBeLessThan(Date.now() - 90_000)
    expect(nav.messages.at(-1)?.raison).toBe('network')
  })

  it('ne remplace pas une réussite par une réponse API refusée en HTTP 200', async () => {
    const nav = navigateur()
    await nav.requete('/notes/__data.json')
    nav.fetch.mockResolvedValue(reponse('Erreur 517', A, 'stale-version'))
    expect(await (await nav.requete('/notes/__data.json'))?.text()).toContain('Lecture initiale')
    expect(nav.messages.at(-1)?.raison).toBe('stale-version')
    nav.fetch.mockRejectedValue(new Error('Pas de réseau'))
    expect(await (await nav.requete('/notes/__data.json'))?.text()).toContain('Lecture initiale')
  })

  it('ne rend pas les données d’une autre session ou d’un autre profil', async () => {
    const nav = navigateur()
    await nav.requete('/notes/__data.json')
    nav.changerScope(B)
    nav.fetch.mockRejectedValue(new Error('Pas de réseau'))
    await expect(nav.requete('/notes/__data.json')).rejects.toThrow('Aucune lecture hors ligne')
  })

  it('exige le marqueur courant avant de déplier un document privé hors ligne', async () => {
    const nav = navigateur()
    await nav.requete('/notes', { document: true })
    nav.fetch.mockRejectedValue(new Error('Pas de réseau'))
    const html = await (await nav.requete('/notes', { document: true }))!.text()
    expect(html).not.toContain('Lecture initiale')
    const script = /<script>([\s\S]*)<\/script>/.exec(html)![1]!
    const afficher = async (cookie: string) => {
      const sorties: string[] = []
      await runInNewContext(script, {
        location: { href: 'https://ecole.test/notes' },
        fetch: (_url: string, options: { headers: Record<string, string> }) => nav.requete('/notes', options),
        document: { cookie, open() {}, close() {}, write: (texte: string) => sorties.push(texte) },
      })
      return sorties.join('')
    }
    expect(await afficher(`${COOKIE_CACHE}=${A}`)).toContain('Lecture initiale')
    expect(await afficher(`${COOKIE_CACHE}=${B}`)).not.toContain('Lecture initiale')
    expect(await afficher('')).toContain('Reconnectez-vous')
  })

  it('oublie les lectures lors d’une déconnexion même sans réseau', async () => {
    const nav = navigateur()
    await nav.requete('/notes/__data.json')
    nav.fetch.mockRejectedValue(new Error('Pas de réseau'))
    const response = await nav.requete('/deconnexion', { method: 'POST' })
    expect(response?.status).toBe(503)
    expect(nav.magasins.size).toBe(0)
    expect(await response?.text()).toContain('Aucune écriture n’est mise en attente')
  })

  it('ne cache jamais une connexion ni une pièce jointe', async () => {
    const nav = navigateur()
    expect(await nav.requete('/piece-jointe/devoir/123')).toBeNull()
    await nav.requete('/connexion', { document: true })
    expect(nav.magasins.size).toBe(0)
  })

  it('refuse une lecture expirée et efface le cache sur demande du navigateur', async () => {
    const nav = navigateur()
    nav.fetch.mockResolvedValue(reponse('Ancienne lecture', A, undefined, Date.now() - 1))
    await nav.requete('/notes/__data.json')
    nav.fetch.mockRejectedValue(new Error('Pas de réseau'))
    await expect(nav.requete('/notes/__data.json')).rejects.toThrow('Aucune lecture hors ligne')
    await nav.effacer()
    expect(nav.magasins.size).toBe(0)
  })

  it('conserve la raison compte verrouillé et oublie l’ancien compte après une nouvelle lecture', async () => {
    const nav = navigateur()
    await nav.requete('/notes/__data.json')
    nav.fetch.mockResolvedValue(reponse('Compte verrouillé', A, 'account-blocked'))
    await nav.requete('/notes/__data.json')
    expect(nav.messages.at(-1)?.raison).toBe('account-blocked')
    nav.changerScope(B)
    nav.fetch.mockResolvedValue(reponse('Autre compte', B))
    await nav.requete('/notes/__data.json')
    expect([...nav.magasins.keys()]).toEqual([`e2r-pages-${B}`])
  })

  it('n’enregistre pas une lecture qui termine après l’effacement de sa session', async () => {
    const nav = navigateur()
    let terminer!: (response: Response) => void
    nav.fetch.mockImplementation(() => new Promise((resolve) => { terminer = resolve }))
    const lecture = nav.requete('/notes/__data.json')
    await vi.waitFor(() => expect(nav.fetch).toHaveBeenCalled())
    await nav.effacer()
    terminer(reponse('Lecture en retard'))
    await lecture
    expect(nav.magasins.size).toBe(0)
  })
})
