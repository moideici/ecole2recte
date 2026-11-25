import { describe, expect, it } from 'vitest'
import { EcoleDirecteClient } from '../src/client.js'
import { failureForHttpStatus, retryAfterMs, RETRY_AFTER_MAX_MS } from '../src/codes.js'
import { FakeEngine, GTK_EXCHANGE, STUDENT_PAYLOAD, loginResponse } from './fake.js'

/*
 * Un refus en amont (limitation de débit, adresse jugée suspecte, pare-feu) n'arrive pas en
 * JSON. Le classer « le protocole a changé » n'apprenait rien et laissait insister — ce qui
 * est exactement ce qui prolonge un blocage. Ici : chaque refus est reconnu pour ce qu'il est.
 */

describe('Retry-After', () => {
  const maintenant = Date.parse('2026-11-25T10:00:00Z')

  it('lit des secondes et des dates HTTP', () => {
    expect(retryAfterMs('120', maintenant)).toBe(120_000)
    expect(retryAfterMs('Wed, 25 Nov 2026 10:10:00 GMT', maintenant)).toBe(600_000)
  })

  it('borne une valeur absurde, et rend au moins une seconde', () => {
    expect(retryAfterMs('99999999', maintenant)).toBe(RETRY_AFTER_MAX_MS)
    expect(retryAfterMs('0', maintenant)).toBe(1000)
    expect(retryAfterMs('Wed, 25 Nov 2026 09:00:00 GMT', maintenant)).toBe(1000)
  })

  it('ne devine rien quand c’est absent ou illisible', () => {
    expect(retryAfterMs(undefined)).toBeUndefined()
    expect(retryAfterMs('bientôt')).toBeUndefined()
  })
})

describe('le statut HTTP quand le corps n’est pas du JSON', () => {
  it('429 : il faut patienter, avec la durée demandée', () => {
    expect(failureForHttpStatus(429, '90')).toMatchObject({ ok: false, kind: 'rate-limited', retryAfterMs: 90_000 })
    expect(failureForHttpStatus(429, undefined)).toMatchObject({ kind: 'rate-limited' })
    expect(failureForHttpStatus(429, undefined)?.retryAfterMs).toBeUndefined()
  })

  it('503 avec Retry-After : patienter ; sans : panne passagère', () => {
    expect(failureForHttpStatus(503, '30')).toMatchObject({ kind: 'rate-limited', retryAfterMs: 30_000 })
    expect(failureForHttpStatus(503, undefined)).toMatchObject({ kind: 'network' })
  })

  it('403 : refus en amont, adresse en cause', () => {
    const refus = failureForHttpStatus(403, undefined)
    expect(refus).toMatchObject({ kind: 'ip-blocked' })
    expect(refus?.message).toMatch(/VPN/)
  })

  it('500, 502 et 504 sont des pannes passagères, réessayables', () => {
    for (const statut of [500, 502, 504]) expect(failureForHttpStatus(statut, undefined)).toMatchObject({ kind: 'network' })
  })

  it('ne dit rien des statuts ordinaires', () => {
    for (const statut of [200, 301, 404]) expect(failureForHttpStatus(statut, undefined)).toBeUndefined()
  })
})

describe('dans le client', () => {
  const client = (engine: FakeEngine) => new EcoleDirecteClient({ engine })

  it('un 403 HTML au GTK devient « adresse refusée », sans autre requête', async () => {
    const engine = new FakeEngine([{ match: 'gtk=1', status: 403, body: '<html>Access denied</html>' }])
    const issue = await client(engine).login('camille', 'x')
    expect(issue).toMatchObject({ ok: false, kind: 'ip-blocked' })
    // Aucun login n'est tenté derrière un refus : insister aggrave le blocage.
    expect(engine.requests).toHaveLength(1)
  })

  it('un 429 au login garde le Retry-After', async () => {
    const engine = new FakeEngine([
      GTK_EXCHANGE,
      { match: 'login.awp', status: 429, headers: { 'retry-after': ['45'] }, body: '' },
    ])
    const issue = await client(engine).login('camille', 'x')
    expect(issue).toMatchObject({ ok: false, kind: 'rate-limited', retryAfterMs: 45_000 })
  })

  it('un 502 en HTML au login est une panne passagère, pas un changement de protocole', async () => {
    const engine = new FakeEngine([GTK_EXCHANGE, { match: 'login.awp', status: 502, body: '<html>Bad gateway</html>' }])
    expect(await client(engine).login('camille', 'x')).toMatchObject({ ok: false, kind: 'network' })
  })

  it('une réponse JSON normale reste lue comme avant', async () => {
    const engine = new FakeEngine([GTK_EXCHANGE, loginResponse(200, STUDENT_PAYLOAD)])
    expect((await client(engine).login('camille', 'x')).ok).toBe(true)
  })

  it('un corps HTML sur un statut ordinaire reste un problème de protocole', async () => {
    const engine = new FakeEngine([GTK_EXCHANGE, { match: 'login.awp', status: 200, body: '<html>?</html>' }])
    expect(await client(engine).login('camille', 'x')).toMatchObject({ ok: false, kind: 'protocol' })
  })
})
