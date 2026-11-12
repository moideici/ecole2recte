import { describe, expect, it } from 'vitest'
import type { Lesson } from '@ecole2recte/protocol'
import { calendarIcs, escapeIcs, foldIcs, lessonUid, readAlternance, validDate, weekLabel } from './exportsEdt.js'
const lesson: Lesson = { id: '42', subject: 'Français', teacher: 'Mme Exemple', room: 'A,1;2', start: '2026-10-26T08:00:00', end: '2026-10-26T09:00:00', canceled: false, exam: true, note: 'Une ligne\nPuis une autre', group: '', kind: '' }
describe('exports ICS', () => {
  it('échappe les caractères texte et les retours de ligne', () => {
    expect(escapeIcs('a,b;c\\d\r\ne\rf\ng')).toBe('a\\,b\\;c\\\\d\\ne\\nf\\ng')
  })
  it('plie à 75 octets sans couper les accents et reconstitue le texte', () => {
    const text = 'SUMMARY:' + 'é😀'.repeat(80)
    const folded = foldIcs(text)
    expect(folded.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true)
    expect(folded.replace(/\r\n /g, '')).toBe(text)
  })
  it('décrit le fuseau été/hiver, les contrôles et exclut les annulations', async () => {
    const result = await calendarIcs([lesson, { ...lesson, id: 'annule', canceled: true }], 'profil', null, new Date('2026-11-12T10:00:00Z'))
    expect(result.match(/BEGIN:VEVENT/g)).toHaveLength(1)
    expect(result).toContain('DTSTART;TZID=Europe/Paris:20261026T080000\r\n')
    expect(result).toContain('TZOFFSETTO:+0200')
    expect(result).toContain('TZOFFSETTO:+0100')
    expect(result).toContain('DTSTAMP:20261112T100000Z')
    expect(result).toContain('SUMMARY:Contrôle · Français')
    expect(result).toContain('LOCATION:A\\,1\\;2')
    expect(result).toContain('DESCRIPTION:Mme Exemple\\nUne ligne\\nPuis une autre')
    expect(result.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })
  it('garde un UID lors des changements et isole profils et occurrences', async () => {
    const uid = await lessonUid('enfant', lesson)
    expect(await lessonUid('enfant', { ...lesson, room: 'Autre', teacher: 'Autre', start: '2026-10-26T10:00:00' })).toBe(uid)
    expect(await lessonUid('autre', lesson)).not.toBe(uid)
    expect(await lessonUid('enfant', { ...lesson, start: '2026-11-02T08:00:00' })).not.toBe(uid)
  })
})
describe('alternance personnelle', () => {
  it('valide les dates et refuse un cookie invalide', () => {
    expect(validDate('2026-02-30')).toBe(false)
    expect(readAlternance('2026-10-26:C')).toBeNull()
    expect(readAlternance(undefined)).toBeNull()
  })
  it('alterne avant et après le repère, y compris au changement d’année', () => {
    const setting = readAlternance('2026-12-28:A')
    expect(weekLabel('2027-01-04', setting)).toBe('Semaine B')
    expect(weekLabel('2026-12-21', setting)).toBe('Semaine B')
    expect(weekLabel('2027-01-11', setting)).toBe('Semaine A')
    expect(weekLabel('2026-10-26', null)).toBe('')
  })
})
