import { describe, expect, it } from 'vitest'
import { averageLabel, averageSeries, classDelta, isNewGrade } from '../src/grade-trends.js'
import { parseGrades } from '../src/parse/grades.js'

const read = (notes: object[]) => parseGrades({ notes }).grades
const note = (id: number, extra: object = {}) => ({ id, libelleMatiere: 'Mathématiques', codePeriode: 'T1', valeur: 10, date: '2026-11-01', ...extra })

describe('indicateurs des notes', () => {
  it('sépare la saisie du devoir et conserve les repères de classe', () => {
    const grade = read([note(1, { dateSaisie: '2026-11-10', moyenneClasse: '8,5', minClasse: 2, maxClasse: 19 })])[0]!
    expect(grade).toMatchObject({ date: '2026-11-01', enteredOn: '2026-11-10', classAverage: 8.5, minimum: 2, maximum: 19 })
    expect(classDelta(grade)).toBe(1.5)
    expect(classDelta({ ...grade, value: undefined })).toBeUndefined()
    expect(classDelta({ ...grade, classAverage: undefined })).toBeUndefined()
    expect(classDelta({ ...grade, value: 0 })).toBe(-8.5)
  })

  it('signale trois jours calendaires avec priorité à la saisie, jamais le futur', () => {
    const grade = read([note(1, { dateSaisie: '2026-11-10' })])[0]!
    for (const day of ['10', '11', '12']) expect(isNewGrade(grade, `2026-11-${day}`)).toBe(true)
    expect(isNewGrade(grade, '2026-11-13')).toBe(false)
    expect(isNewGrade(grade, '2026-11-09')).toBe(false)
    expect(isNewGrade({ ...grade, enteredOn: undefined }, '2026-11-02')).toBe(true)
    expect(isNewGrade({ ...grade, enteredOn: undefined, date: undefined }, '2026-11-02')).toBe(false)
  })

  it('étiquette les moyennes officielles et les deux sortes de calcul', () => {
    expect(averageLabel('official')).toBe('Officielle')
    expect(averageLabel('computed')).toBe('Calculée par l’appli')
    expect(averageLabel('recomputed')).toBe('Calculée par l’appli')
    expect(averageLabel('none')).toBe('Indisponible')
  })

  it('construit une série chronologique cumulée, par jour, pondérée et sur 20', () => {
    const grades = read([
      note(1), note(2, { valeur: 10, noteSur: 10, coef: 2, date: '2026-11-02' }),
      note(3, { valeur: 0, nonSignificatif: true }), note(4, { valeur: 'Abs' }),
      note(5, { date: undefined }), note(6, { codePeriode: 'T2' }),
    ])
    const series = averageSeries(grades, 'T1', [], 'Mathématiques')
    expect(series.map((point) => point.date)).toEqual(['2026-11-01', '2026-11-02'])
    expect(series[0]!.value).toBe(10)
    expect(series[1]!.value).toBeCloseTo(50 / 3)
    expect(averageSeries([], 'T1', [])).toEqual([])
  })

  it('pondère les matières plutôt que le nombre de devoirs pour la générale', () => {
    const grades = read([note(1), note(2), note(3, { libelleMatiere: 'Français', valeur: 20 })])
    const subjects = [{ periodCode: 'T1', subject: 'Français', coefficient: 3, teacher: '', teachers: [], appreciation: '', parentSubject: '' }]
    expect(averageSeries(grades, 'T1', subjects)).toEqual([{ date: '2026-11-01', value: 17.5 }])
  })
})
