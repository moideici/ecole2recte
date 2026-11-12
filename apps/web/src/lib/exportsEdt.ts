import type { Lesson } from '@ecole2recte/protocol'
import { startOfWeek } from '@ecole2recte/protocol'

export interface Alternance { week: string; label: 'A' | 'B' }
export function validDate(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
}
export function readAlternance(value: string | undefined): Alternance | null {
  const [week, label] = (value ?? '').split(':')
  return validDate(week ?? null) && (label === 'A' || label === 'B') ? { week: week!, label } : null
}
export function weekLabel(date: string, setting: Alternance | null): string {
  if (!setting) return ''
  const weeks = Math.round((Date.parse(startOfWeek(date)) - Date.parse(startOfWeek(setting.week))) / 604800000)
  return `Semaine ${Math.abs(weeks % 2) === 0 ? setting.label : setting.label === 'A' ? 'B' : 'A'}`
}
export function escapeIcs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}
/** Le pliage compte les octets UTF-8, sans couper un accent ni une paire de substitution. */
export function foldIcs(line: string): string {
  let result = '', length = 0
  for (const character of line) {
    const size = new TextEncoder().encode(character).length
    if (length + size > 75) { result += '\r\n '; length = 1 }
    result += character
    length += size
  }
  return result
}
export async function lessonUid(profile: string, lesson: Lesson): Promise<string> {
  // Le profil évite les collisions entre enfants ; salle et professeur peuvent changer.
  const input = JSON.stringify([profile, lesson.id, lesson.start.slice(0, 10)])
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return `${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}@ecole2recte`
}
const compact = (value: string) => value.replace(/[-:]/g, '').slice(0, 15)
export async function calendarIcs(lessons: Lesson[], profile: string, setting: Alternance | null = null, now = new Date()): Promise<string> {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ecole2recte//Emploi du temps//FR', 'CALSCALE:GREGORIAN',
    'BEGIN:VTIMEZONE', 'TZID:Europe/Paris', 'BEGIN:DAYLIGHT', 'DTSTART:19700329T020000', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
    'BEGIN:STANDARD', 'DTSTART:19701025T030000', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD', 'END:VTIMEZONE']
  for (const lesson of lessons.filter((entry) => !entry.canceled)) {
    lines.push('BEGIN:VEVENT', `UID:${await lessonUid(profile, lesson)}`, `DTSTAMP:${compact(now.toISOString())}Z`,
      `DTSTART;TZID=Europe/Paris:${compact(lesson.start)}`, `DTEND;TZID=Europe/Paris:${compact(lesson.end)}`,
      `SUMMARY:${escapeIcs([lesson.exam ? 'Contrôle' : '', lesson.subject, weekLabel(lesson.start.slice(0, 10), setting)].filter(Boolean).join(' · '))}`,
      `LOCATION:${escapeIcs(lesson.room)}`, `DESCRIPTION:${escapeIcs([lesson.teacher, lesson.group, lesson.note].filter(Boolean).join('\n'))}`, 'END:VEVENT')
  }
  return [...lines, 'END:VCALENDAR'].map(foldIcs).join('\r\n') + '\r\n'
}
