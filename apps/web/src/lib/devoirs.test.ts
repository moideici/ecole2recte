import { describe, expect, it } from 'vitest'
import type { HomeworkItem } from '@ecole2recte/protocol'
import { filtrerDevoirs, joursAvantControle, lireFiltre } from './devoirs.js'

const devoir = (id: string, valeurs: Partial<HomeworkItem> = {}): HomeworkItem => ({
  id, subject: 'Mathématiques', dueDate: '2026-03-28', content: '', exam: false, done: false, attachments: [], onlineSubmission: false, ...valeurs,
})

describe('filtres des devoirs', () => {
  const a = devoir('a'), b = devoir('b', { done: true, exam: true }), c = devoir('c', { exam: true })
  const devoirs = [a, b, c]
  it('sélectionne chaque filtre sans muter la liste', () => {
    expect(filtrerDevoirs(devoirs, 'afaire')).toEqual([a, c])
    expect(filtrerDevoirs(devoirs, 'faits')).toEqual([b])
    expect(filtrerDevoirs(devoirs, 'controles')).toEqual([b, c])
    expect(filtrerDevoirs(devoirs, 'tous')).toEqual(devoirs)
    expect(devoirs).toEqual([a, b, c])
  })
  it('respecte les surcharges dans les deux sens', () => {
    expect(filtrerDevoirs(devoirs, 'faits', { a: true, b: false })).toEqual([a])
  })
  it('valide le filtre et revient à à faire pour une valeur inconnue', () => {
    for (const filtre of ['afaire', 'faits', 'controles', 'tous'] as const) expect(lireFiltre(filtre)).toBe(filtre)
    expect(lireFiltre('inconnu')).toBe('afaire')
    expect(lireFiltre(null)).toBe('afaire')
  })
})

describe('prochain contrôle', () => {
  it.each([['2026-03-28', 0], ['2026-03-29', 1], ['2026-04-02', 5]] as const)('compte les jours jusqu’au %s en UTC', (date, jours) => {
    const item = devoir('controle', { exam: true, dueDate: date })
    expect(joursAvantControle([devoir('ancien', { exam: true, dueDate: '2026-03-27' }), devoir('plus-tard', { exam: true, dueDate: '2026-05-01' }), item], '2026-03-28')).toEqual({ jours, item })
  })
  it('ne trouve rien sans contrôle à venir', () => {
    expect(joursAvantControle([devoir('normal'), devoir('passe', { exam: true, dueDate: '2026-03-27' })], '2026-03-28')).toBeUndefined()
    expect(joursAvantControle([], '2026-03-28')).toBeUndefined()
  })
})
