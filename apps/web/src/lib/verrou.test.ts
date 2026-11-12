import { describe, expect, it } from 'vitest'
import {
  attenteApresEchecs, codeValide, creerVerrou, doitVerrouiller, hacherCode, libelleDelai, lireVerrou, verifierCode,
} from './verrou.js'

describe('le code', () => {
  it('accepte 4 à 6 chiffres, rien d’autre', () => {
    for (const bon of ['1234', '12345', '123456']) expect(codeValide(bon)).toBe(true)
    for (const mauvais of ['123', '1234567', 'abcd', '12 34', '', '12.4']) expect(codeValide(mauvais)).toBe(false)
  })

  it('ne garde que le haché : le code ne se retrouve nulle part dans l’état', async () => {
    const etat = await creerVerrou('482916', 5)
    expect(JSON.stringify(etat)).not.toContain('482916')
    expect(etat.hash.length).toBeGreaterThan(20)
  })

  it('vérifie le bon code, refuse les autres et les formats invalides', async () => {
    const etat = await creerVerrou('2468', 1)
    expect(await verifierCode(etat, '2468')).toBe(true)
    expect(await verifierCode(etat, '2469')).toBe(false)
    expect(await verifierCode(etat, '24680')).toBe(false)
    expect(await verifierCode(etat, 'abcd')).toBe(false)
  })

  it('sale chaque code : deux verrous du même code n’ont pas le même haché', async () => {
    const [a, b] = await Promise.all([creerVerrou('1111', 0), creerVerrou('1111', 0)])
    expect(a.sel).not.toBe(b.sel)
    expect(a.hash).not.toBe(b.hash)
    expect(await hacherCode('1111', a.sel)).toBe(a.hash)
  })

  it('refuse de créer un verrou avec un code invalide', async () => {
    await expect(creerVerrou('12', 5)).rejects.toThrow()
  })
})

describe('le délai', () => {
  it('« immédiatement » verrouille dès que la page a été cachée', () => {
    expect(doitVerrouiller(0, 0)).toBe(true)
  })

  it('verrouille quand le délai est écoulé, pas avant', () => {
    expect(doitVerrouiller(5, 4 * 60_000 + 59_000)).toBe(false)
    expect(doitVerrouiller(5, 5 * 60_000)).toBe(true)
    expect(doitVerrouiller(1, 59_999)).toBe(false)
    expect(doitVerrouiller(15, 15 * 60_000 + 1)).toBe(true)
  })

  it('a un libellé lisible', () => {
    expect(libelleDelai(0)).toBe('Immédiatement')
    expect(libelleDelai(1)).toBe('Après 1 minute')
    expect(libelleDelai(15)).toBe('Après 15 minutes')
  })
})

describe('les essais ratés', () => {
  it('ne bloquent pas avant le cinquième, puis imposent une attente qui double jusqu’à 15 minutes', () => {
    expect([0, 1, 4].map(attenteApresEchecs)).toEqual([0, 0, 0])
    expect(attenteApresEchecs(5)).toBe(30_000)
    expect(attenteApresEchecs(6)).toBe(60_000)
    expect(attenteApresEchecs(7)).toBe(120_000)
    expect(attenteApresEchecs(40)).toBe(15 * 60_000)
  })
})

describe('lire l’état gardé', () => {
  it('rend null pour tout ce qui n’est pas un état valide', () => {
    for (const brut of [null, '', 'pas du json', '{}', '{"sel":"a","hash":"b","delai":7}', '{"sel":1,"hash":"b","delai":5}']) {
      expect(lireVerrou(brut)).toBeNull()
    }
  })

  it('relit un état valide, et ne garde que les champs connus', () => {
    const lu = lireVerrou('{"sel":"a","hash":"b","delai":5,"webauthn":"c","autre":"x"}')
    expect(lu).toEqual({ sel: 'a', hash: 'b', delai: 5, webauthn: 'c' })
  })
})
