import { describe, expect, it } from 'vitest'
import { anciennete, cleLecture, pageLisible, peutRafraichir, raisonRepli } from './horsLigne.js'

describe('repli hors ligne', () => {
  it('distingue le réseau local du mandataire et privilégie une cause utile', () => {
    expect(raisonRepli(false, ['stale-version'])).toBe('network')
    expect(raisonRepli(true, ['network'])).toBe('unavailable')
    expect(raisonRepli(true, ['protocol', 'stale-version'])).toBe('stale-version')
    expect(raisonRepli(true, ['account-blocked', 'network'])).toBe('account-blocked')
    expect(raisonRepli(true, [])).toBeNull()
  })

  it('annonce la date réelle dans le fuseau français et les heures écoulées', () => {
    const date = Date.parse('2026-11-05T17:00:00Z')
    expect(anciennete(date, date + 3 * 3600_000)).toBe('Données du 5 nov. à 18 h (il y a 3 h)')
    expect(anciennete(date, date + 59_000)).toContain('à l’instant')
    expect(anciennete(date, date + 60_000)).toContain('il y a 1 min')
    expect(anciennete(date, date + 86400_000)).toContain('il y a 1 j')
    expect(anciennete(date, date - 1000)).toContain('à l’instant')
  })

  it('ne relit rien avant 90 secondes, y compris à la limite', () => {
    expect(peutRafraichir(null, 1000)).toBe(true)
    expect(peutRafraichir(1000, 90_999)).toBe(false)
    expect(peutRafraichir(1000, 91_000)).toBe(true)
    expect(peutRafraichir(1000, 0)).toBe(false)
  })

  it('réutilise la page après actualisation sans confondre les filtres', () => {
    expect(cleLecture('https://ecole.test/notes?periode=A&rafraichir=1')).toBe(cleLecture('https://ecole.test/notes?periode=A'))
    expect(cleLecture('https://ecole.test/notes?periode=A')).not.toBe(cleLecture('https://ecole.test/notes?periode=B'))
    expect(cleLecture('https://ecole.test/notes?z=2&a=1')).toBe(cleLecture('https://ecole.test/notes?a=1&z=2'))
  })

  it('exclut connexion, déconnexion et pièces jointes, aussi en navigation SvelteKit', () => {
    for (const path of ['/connexion', '/connexion/__data.json', '/deconnexion', '/piece-jointe/devoir/123']) expect(pageLisible(path)).toBe(false)
    for (const path of ['/', '/prof/notes', '/devoirs/2026-11-05', '/notes/__data.json']) expect(pageLisible(path)).toBe(true)
  })
})
