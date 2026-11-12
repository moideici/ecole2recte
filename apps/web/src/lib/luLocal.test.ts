import { describe, expect, it } from 'vitest'
import { lireEtat, basculer, estNouveau } from './luLocal.js'

describe('marquage local', () => {
  it.each([null, '', '{', 'null', '[]', '42', '"texte"'])('tolère un état invalide : %s', (brut) => {
    expect(lireEtat(brut)).toEqual({})
  })
  it('ne garde que les booléens', () => {
    expect(lireEtat('{"a":true,"b":false,"c":"oui"}')).toEqual({ a: true, b: false })
  })
  it('bascule sans muter son entrée et respecte la lecture actuelle', () => {
    const etat = { autre: true }
    const suivant = basculer(etat, 'message', false)
    expect(suivant).toEqual({ autre: true, message: true })
    expect(suivant).not.toBe(etat)
    expect(etat).toEqual({ autre: true })
    expect(basculer(suivant, 'message', true).message).toBe(false)
  })
})

describe('pastille Nouveau', () => {
  it.each([['2026-03-30', true], ['2026-03-28', true], ['2026-03-27', false], ['2026-03-31', false], ['', false]])('vérifie la date %s', (date, attendu) => {
    expect(estNouveau(date, '2026-03-30')).toBe(attendu)
  })
})
