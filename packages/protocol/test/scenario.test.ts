import { describe, expect, it } from 'vitest'
import { simulateScenario } from '../src/insights.js'
import type { Grade, SubjectAverage } from '../src/models.js'
import type { SubjectVerdict } from '../src/insights.js'

function note(id: string, subject: string, value: number, coefficient = 1, scale = 20): Grade {
  return { id, subject, label: id, value, scale, coefficient, periodCode: 'T1', counted: true, comment: '', kind: '', skills: [] }
}

function matiere(subject: string, coefficient: number, value: number | undefined): SubjectVerdict {
  const average: SubjectAverage = { periodCode: 'T1', subject, teacher: '', teachers: [], appreciation: '', parentSubject: '', coefficient }
  return { average, verdict: { value, computed: true, origin: 'computed', behind: [] } as unknown as SubjectVerdict['verdict'] }
}

const notes = [note('a', 'Maths', 10), note('b', 'Maths', 14), note('c', 'Anglais', 12)]
const matieres = [matiere('Maths', 2, 12), matiere('Anglais', 1, 12)]

describe('simulateScenario', () => {
  it('sans changement, rien n’est touché', () => {
    const resultat = simulateScenario(notes, 'T1', matieres)
    expect(resultat.subjects).toEqual([])
    expect(resultat.generalAfter).toBeCloseTo(12)
    expect(resultat.generalDelta).toBeCloseTo(0)
  })

  it('plusieurs notes dans plusieurs matières', () => {
    const resultat = simulateScenario(notes, 'T1', matieres, [
      { subject: 'Maths', value: 20 },
      { subject: 'Maths', value: 20 },
      { subject: 'Anglais', value: 4 },
    ])
    const maths = resultat.subjects.find((m) => m.subject === 'Maths')
    const anglais = resultat.subjects.find((m) => m.subject === 'Anglais')
    // (10 + 14 + 20 + 20) / 4 = 16 ; (12 + 4) / 2 = 8
    expect(maths?.after).toBeCloseTo(16)
    expect(anglais?.after).toBeCloseTo(8)
    // générale : (16 × 2 + 8 × 1) / 3
    expect(resultat.generalAfter).toBeCloseTo(40 / 3)
  })

  it('le coefficient d’une note imaginaire pèse dans la moyenne', () => {
    const resultat = simulateScenario(notes, 'T1', matieres, [{ subject: 'Anglais', value: 18, coefficient: 3 }])
    // (12 + 18 × 3) / 4 = 16,5
    expect(resultat.subjects[0]?.after).toBeCloseTo(16.5)
  })

  it('un barème différent est ramené sur 20', () => {
    const resultat = simulateScenario(notes, 'T1', matieres, [{ subject: 'Anglais', value: 5, scale: 10 }])
    // 5/10 = 10/20 ; (12 + 10) / 2 = 11
    expect(resultat.subjects[0]?.after).toBeCloseTo(11)
  })

  it('changer le coefficient d’une note existante', () => {
    const resultat = simulateScenario(notes, 'T1', matieres, [], { a: { coefficient: 3 } })
    // (10 × 3 + 14) / 4 = 11
    expect(resultat.subjects[0]?.after).toBeCloseTo(11)
  })

  it('écarter une note existante', () => {
    const resultat = simulateScenario(notes, 'T1', matieres, [], { a: { ignored: true } })
    expect(resultat.subjects[0]?.after).toBeCloseTo(14)
  })

  it('un coefficient nul ou négatif ne change rien', () => {
    const resultat = simulateScenario(notes, 'T1', matieres, [], { a: { coefficient: 0 } })
    expect(resultat.subjects[0]?.after).toBeCloseTo(12)
  })

  it('tout écarter ne laisse aucune moyenne, sans inventer de zéro', () => {
    const resultat = simulateScenario(notes, 'T1', matieres, [], { c: { ignored: true } })
    expect(resultat.subjects[0]?.after).toBeUndefined()
    expect(resultat.subjects[0]?.delta).toBeUndefined()
    expect(resultat.generalAfter).toBeCloseTo(12)
  })
})
