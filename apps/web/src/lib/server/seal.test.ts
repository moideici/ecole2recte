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
    // Le mode GCM authentifie : un seul octet changé invalide tout.
    //
    // On modifie bien un **octet**, et non un caractère de la chaîne : en base64, les bits
    // de poids faible du dernier caractère peuvent ne pas être décodés du tout. Changer
    // cette lettre-là donne parfois exactement les mêmes octets — et le test passait alors
    // sans avoir rien altéré.
    expect(unseal(alterer(seal({ cn: 'a', cv: 'b' })))).toBeNull()
  })

  it('refuse un sceau modifié, quelle que soit la valeur scellée', () => {
    // Cent tirages : le vecteur d'initialisation est aléatoire, donc la charge aussi.
    for (let essai = 0; essai < 100; essai += 1) {
      expect(unseal(alterer(seal({ essai })))).toBeNull()
    }
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

/** Retourne le même sceau avec un octet de charge modifié, et rien d'autre. */
function alterer(sceau: string): string {
  const parts = sceau.split('.')
  const octets = Buffer.from(parts[2] as string, 'base64url')
  octets[0] = (octets[0]! + 1) % 256
  return [parts[0], parts[1], octets.toString('base64url')].join('.')
}
