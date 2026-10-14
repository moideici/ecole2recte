import { afterEach, describe, expect, it, vi } from 'vitest'
import { SESSION_LONGUE_TTL_MS, SESSION_TTL_MS, sessions, ttlFor } from './store.js'
import { createSession } from '@ecole2recte/protocol'

function creer() {
  return sessions.create({
    protocol: createSession({ token: 'JETON' }),
    accounts: [],
    activeAccountId: null,
    awaitingSecurityAnswer: false,
    snapshots: {},
  })
}

describe('magasin de sessions', () => {
  it('rend un identifiant opaque et imprévisible', async () => {
    const premier = await creer()
    const second = await creer()
    expect(premier).not.toBe(second)
    // 32 octets en base64url : c'est la seule chose que le navigateur détient.
    expect(premier.length).toBeGreaterThanOrEqual(42)
    expect(premier).not.toMatch(/[^A-Za-z0-9_-]/)
  })

  it('ne rend rien pour un identifiant inconnu', async () => {
    expect(await sessions.read('inexistant')).toBeNull()
  })

  it('conserve puis oublie', async () => {
    const id = await creer()
    expect((await sessions.read(id))?.protocol.token).toBe('JETON')
    await sessions.destroy(id)
    expect(await sessions.read(id)).toBeNull()
  })

  it('n’écrit pas dans une session détruite', async () => {
    const id = await creer()
    const record = (await sessions.read(id))!
    await sessions.destroy(id)
    await sessions.write(id, record)
    // Sans cette garde, se déconnecter puis finir une requête en vol ressusciterait la session.
    expect(await sessions.read(id)).toBeNull()
  })
})

describe('durée de vie', () => {
  afterEach(() => vi.useRealTimers())

  const ouvrir = (remembered?: string) =>
    sessions.create({
      protocol: createSession({ token: 'JETON' }),
      accounts: [],
      activeAccountId: null,
      awaitingSecurityAnswer: false,
      snapshots: {},
      ...(remembered ? { remembered } : {}),
    })

  it('une session ordinaire vit douze heures, une session « rester connecté » trente jours', () => {
    expect(ttlFor({})).toBe(SESSION_TTL_MS)
    expect(ttlFor({ remembered: 'scelle' })).toBe(SESSION_LONGUE_TTL_MS)
    expect(SESSION_LONGUE_TTL_MS).toBeGreaterThan(SESSION_TTL_MS)
  })

  it('la session ordinaire meurt après douze heures sans écriture', async () => {
    vi.useFakeTimers()
    const id = await ouvrir()
    vi.advanceTimersByTime(SESSION_TTL_MS + 1000)
    expect(await sessions.read(id)).toBeNull()
  })

  it('la session « rester connecté » survit au lendemain, et s’éteint après trente jours', async () => {
    // C'était le bug : douze heures pour tout le monde, identifiants scellés compris.
    vi.useFakeTimers()
    const id = await ouvrir('scelle')
    vi.advanceTimersByTime(3 * 24 * 60 * 60 * 1000)
    expect(await sessions.read(id)).not.toBeNull()
    vi.advanceTimersByTime(SESSION_LONGUE_TTL_MS)
    expect(await sessions.read(id)).toBeNull()
  })
})
