import { describe, expect, it } from 'vitest'
import { parseTimetable, type Lesson } from '@ecole2recte/protocol'
import { fusionnerCours, nomPause, pauses } from './emploiDuTemps.js'

const cours: Lesson = {
  id: '1', subject: 'Mathématiques', teacher: 'Mme Martin', room: 'A 12',
  start: '2026-11-12T08:00:00', end: '2026-11-12T09:00:00',
  canceled: false, exam: false, note: '', group: '', kind: 'COURS',
}
const suivant = { ...cours, id: '2', start: cours.end, end: '2026-11-12T10:00:00' }

describe('présentation de l’emploi du temps', () => {
  it('fusionne les cours doubles sans modifier les données reçues', () => {
    expect(fusionnerCours([suivant, cours])).toEqual([{ ...cours, end: suivant.end }])
    expect(cours.end).toBe('2026-11-12T09:00:00')
  })
  it('conserve les différences de salle, groupe, annulation et modification', () => {
    for (const difference of [{ room: 'B' }, { group: 'G2' }, { canceled: true }, { previousRoom: 'C' }]) {
      expect(fusionnerCours([cours, { ...suivant, ...difference }])).toHaveLength(2)
    }
    expect(fusionnerCours([cours, { ...suivant, start: '2026-11-12T09:15:00' }])).toHaveLength(2)
  })
  it('ne crée pas de pause pendant un cours qui chevauche un groupe', () => {
    expect(pauses([{ ...cours, end: '2026-11-12T11:00:00' }, suivant])).toEqual([])
    expect(pauses([cours, { ...suivant, start: '2026-11-12T09:15:00' }])).toEqual([
      { start: cours.end, end: '2026-11-12T09:15:00' },
    ])
  })
  it('nomme le déjeuner et les autres pauses', () => {
    expect(nomPause('2026-11-12T12:00:00', '2026-11-12T13:30:00')).toBe('Pause déjeuner')
    expect(nomPause(cours.start, cours.end)).toBe('Pause')
  })
  it('conserve uniquement les anciennes valeurs explicites et valides', () => {
    const [lu] = parseTimetable([{ start_date: cours.start, end_date: cours.end,
      previousRoom: 'B 104', previousStart: '2026-11-12 07:30' }])
    expect(lu?.previousRoom).toBe('B 104')
    expect(lu?.previousStart).toBe('2026-11-12T07:30:00')
    expect(parseTimetable([{ start_date: cours.start, end_date: cours.end }])[0]?.previousStart).toBeUndefined()
  })
})
