import { beforeEach, expect, it, vi } from 'vitest'
import { observerLecture } from './lecture.js'

const mocks = vi.hoisted(() => ({ lire: vi.fn(), detruire: vi.fn() }))
vi.mock('$lib/server/session.js', () => ({
  COOKIE_NAME: 'e2r', readSession: mocks.lire, setSessionCookie: vi.fn(),
  activeAccount: () => ({ id: 'profil-a' }),
}))
vi.mock('$lib/server/store.js', () => ({
  selectStore: () => ({ destroy: mocks.detruire }),
  withSessionStore: (_store: unknown, fn: () => unknown) => fn(),
  ttlFor: () => 12 * 3600_000,
}))
import { handle } from '../../hooks.server.js'

beforeEach(() => {
  mocks.lire.mockResolvedValue({ id: 'session-test', record: { createdAt: Date.now() } })
  mocks.detruire.mockReset()
})

async function requete(path: string, cause?: string) {
  const cookies = {
    get: () => undefined,
    set: vi.fn(),
    serialize: (nom: string, valeur: string) => `${nom}=${valeur}; Path=/`,
  }
  const response = await handle({
    event: { cookies, locals: {}, url: new URL(`https://ecole.test${path}`) },
    resolve: async (_event: unknown, options: { transformPageChunk: (chunk: { html: string; done: boolean }) => string }) => {
      observerLecture(1000, cause)
      cookies.set.mockImplementation(() => { throw new Error('cookies.set fermé après resolve') })
      return new Response(options.transformPageChunk({ html: '<html><body>Lecture</body></html>', done: true }))
    },
  } as never)
  return { response, cookies }
}

it('pose un marqueur non authentifiant sans utiliser cookies.set après resolve', async () => {
  const { response, cookies } = await requete('/notes')
  expect(response.headers.get('X-E2R-Scope')).toMatch(/^[a-f0-9]{64}$/)
  expect(response.headers.get('Set-Cookie')).toContain('e2r-lecture=')
  expect(response.headers.get('Set-Cookie')).not.toContain('session-test')
  expect(cookies.set).not.toHaveBeenCalled()
  expect(response.headers.get('X-E2R-Date')).toBe('1000')
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
})

it('transmet la raison métier au service worker et au premier affichage', async () => {
  const { response } = await requete('/notes', 'stale-version')
  expect(response.headers.get('X-E2R-Repli')).toBe('stale-version')
  expect(await response.text()).toContain('"raison":"stale-version"')
})

it('ne marque pas les pièces jointes et préserve le marqueur de la page consultée', async () => {
  const { response } = await requete('/piece-jointe/devoir/123')
  expect(response.headers.get('X-E2R-Scope')).toBeNull()
  expect(response.headers.get('Set-Cookie')).toBeNull()
})

it('efface les deux cookies quand une session expire pendant le chargement', async () => {
  mocks.lire.mockResolvedValue({ id: 'session-test', record: { expired: true, createdAt: Date.now() } })
  const { response } = await requete('/notes')
  expect(response.status).toBe(303)
  expect(response.headers.get('Set-Cookie')).toContain('e2r=;')
  expect(response.headers.get('Set-Cookie')).toContain('e2r-lecture=;')
  expect(mocks.detruire).toHaveBeenCalledWith('session-test')
})
