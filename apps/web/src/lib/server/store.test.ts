import { describe, expect, it } from 'vitest'
import { sessions } from './store.js'
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
  it('rend un identifiant opaque et imprévisible', () => {
    const premier = creer()
    const second = creer()
    expect(premier).not.toBe(second)
    // 32 octets en base64url : c'est la seule chose que le navigateur détient.
    expect(premier.length).toBeGreaterThanOrEqual(42)
    expect(premier).not.toMatch(/[^A-Za-z0-9_-]/)
  })

  it('ne rend rien pour un identifiant inconnu', () => {
    expect(sessions.read('inexistant')).toBeNull()
  })

  it('conserve puis oublie', () => {
    const id = creer()
    expect(sessions.read(id)?.protocol.token).toBe('JETON')
    sessions.destroy(id)
    expect(sessions.read(id)).toBeNull()
  })

  it('n’écrit pas dans une session détruite', () => {
    const id = creer()
    const record = sessions.read(id)!
    sessions.destroy(id)
    sessions.write(id, record)
    // Sans cette garde, se déconnecter puis finir une requête en vol ressusciterait la session.
    expect(sessions.read(id)).toBeNull()
  })
})
