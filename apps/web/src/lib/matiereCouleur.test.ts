import { describe, expect, it } from 'vitest'
import { couleurMatiere, rangMatiere } from './matiereCouleur.js'

describe('couleur de matière', () => {
  it('attribue le rang de l’application : String.hashCode du nom en minuscules, modulo 10', () => {
    // "maths".hashCode() = 103 668 331 en Java : rang 1.
    expect(rangMatiere('maths')).toBe(1)
    expect(rangMatiere('MATHS')).toBe(rangMatiere(' maths '))
  })

  it('reste dans les dix couleurs et renvoie les deux jetons du mode', () => {
    for (const nom of ['Mathématiques', 'Français', 'Anglais LV1', '', undefined]) {
      const rang = rangMatiere(nom)
      expect(rang).toBeGreaterThanOrEqual(0)
      expect(rang).toBeLessThan(10)
      expect(couleurMatiere(nom)).toEqual({ fond: `var(--matiere-${rang}-fond)`, encre: `var(--matiere-${rang}-encre)` })
    }
  })
})
