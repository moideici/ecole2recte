import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * Quand rouvrir une session depuis le coffre d'appareil ? Seulement pour une page ou ses
 * données — jamais pour un fichier statique, un POST ou une déconnexion : chacun serait une
 * connexion de plus, et c'est la rafale que tout ce dispositif existe pour empêcher.
 */
const mocks = vi.hoisted(() => ({ lire: vi.fn(), rouvrir: vi.fn(), ecrire: vi.fn() }))
vi.mock('$lib/server/session.js', () => ({
  COOKIE_NAME: 'e2r', readSession: mocks.lire, setSessionCookie: vi.fn(),
  activeAccount: () => ({ id: 'profil-a' }),
}))
vi.mock('$lib/server/appareil.js', () => ({ COOKIE_APPAREIL: 'e2r_appareil', rouvrirDepuisCoffre: mocks.rouvrir }))
vi.mock('$lib/server/store.js', () => ({
  selectStore: () => ({ destroy: vi.fn(), write: mocks.ecrire }),
  withSessionStore: (_s: unknown, fn: () => unknown) => fn(),
  ttlFor: () => 12 * 3600_000,
}))
import { handle } from '../../hooks.server.js'

beforeEach(() => {
  mocks.lire.mockReset().mockResolvedValue(null)
  mocks.rouvrir.mockReset().mockResolvedValue(null)
  mocks.ecrire.mockReset()
})

async function requete(path: string, options: { methode?: string; accept?: string; appareil?: boolean } = {}) {
  const cookies = {
    get: (nom: string) => (nom === 'e2r_appareil' && options.appareil !== false ? 'coffre-1' : undefined),
    set: vi.fn(), delete: vi.fn(),
    serialize: (nom: string, valeur: string) => `${nom}=${valeur}; Path=/`,
  }
  const locals: Record<string, unknown> = {}
  const response = await handle({
    event: {
      cookies, locals, url: new URL(`https://ecole.test${path}`),
      request: new Request(`https://ecole.test${path}`, { method: options.methode ?? 'GET', headers: { accept: options.accept ?? 'text/html' } }),
    },
    resolve: async () => new Response('ok'),
  } as never)
  return { response, locals }
}

describe('réouverture depuis le coffre d’appareil', () => {
  it('rouvre pour une page, et la requête reprend avec la nouvelle session', async () => {
    mocks.rouvrir.mockResolvedValue({ id: 'neuve', record: { createdAt: Date.now(), accounts: [{ id: 'profil-a' }] } })
    const { locals } = await requete('/notes')
    expect(mocks.rouvrir).toHaveBeenCalledTimes(1)
    expect(locals['sessionId']).toBe('neuve')
  })

  it('rouvre aussi pour les données d’une page', async () => {
    await requete('/notes/__data.json', { accept: 'application/json' })
    expect(mocks.rouvrir).toHaveBeenCalledTimes(1)
  })

  it('ne rouvre pas pour un fichier statique', async () => {
    for (const chemin of ['/_app/immutable/chunks/a.js', '/service-worker.js', '/manifest.webmanifest', '/icone.svg']) {
      await requete(chemin, { accept: '*/*' })
    }
    expect(mocks.rouvrir).not.toHaveBeenCalled()
  })

  it('ne rouvre pas pour un POST (connexion volontaire) ni pour la déconnexion', async () => {
    await requete('/connexion', { methode: 'POST' })
    await requete('/deconnexion')
    expect(mocks.rouvrir).not.toHaveBeenCalled()
  })

  it('ne rouvre pas quand une session valide existe déjà', async () => {
    mocks.lire.mockResolvedValue({ id: 's', record: { createdAt: Date.now(), accounts: [] } })
    await requete('/notes')
    expect(mocks.rouvrir).not.toHaveBeenCalled()
  })

  it('journalise le chargement d’une page sans valeur personnelle', async () => {
    const record = { createdAt: Date.now(), accounts: [] } as Record<string, unknown>
    mocks.lire.mockResolvedValue({ id: 's', record })
    await requete('/devoirs/2026-11-12')
    const journal = record['journal'] as Array<{ page: string; resultat: string }>
    expect(journal).toHaveLength(1)
    expect(journal[0]?.page).toBe('/devoirs/…')
    expect(JSON.stringify(journal)).not.toContain('2026-11-12')
  })
})
