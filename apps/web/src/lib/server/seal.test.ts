import { beforeAll, describe, expect, it } from 'vitest'
import { seal, unseal } from './seal.js'
import { env } from '$env/dynamic/private'

beforeAll(() => {
  env['SESSION_SECRET'] = 'un-secret-de-test-suffisamment-long-pour-passer'
})

describe('scellement', () => {
  it('fait l’aller-retour', () => {
    const valeur = { cn: 'CN-abc', cv: 'CV-déf' }
    expect(unseal(seal(valeur))).toEqual(valeur)
  })

  it('ne laisse rien lire en clair', () => {
    const sceau = seal({ cn: 'SECRET-VISIBLE', cv: 'x' })
    expect(sceau).not.toContain('SECRET-VISIBLE')
  })

  it('refuse un sceau modifié', () => {
    // Le mode GCM authentifie : une seule lettre changée invalide tout.
    const sceau = seal({ cn: 'a', cv: 'b' })
    const parts = sceau.split('.')
    const altere = [parts[0], parts[1], (parts[2] as string).replace(/.$/, 'A')].join('.')
    expect(unseal(altere)).toBeNull()
  })

  it('refuse ce qui n’a pas la forme d’un sceau', () => {
    for (const entree of [undefined, '', 'abc', 'a.b', 'a.b.c.d']) {
      expect(unseal(entree as string | undefined)).toBeNull()
    }
  })

  it('rend deux sceaux différents pour la même valeur', () => {
    // Un vecteur d'initialisation aléatoire : deux cookies identiques trahiraient l'égalité.
    expect(seal({ a: 1 })).not.toBe(seal({ a: 1 }))
  })
})
