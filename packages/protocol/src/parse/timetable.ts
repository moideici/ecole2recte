import type { Lesson } from '../models.js'
import { objects, pickBool, pickDateTime, pickText } from './json.js'

/**
 * L'emploi du temps.
 *
 * Deux champs valent qu'on s'y arrête. `isAnnule` : un cours annulé reste dans la réponse,
 * et l'effacer ferait croire à un trou alors que la salle est réservée. `groupe` : quand la
 * classe est scindée, deux cours se superposent à la même heure — sans le groupe, on croit
 * à un doublon et on en supprime un.
 */
export function parseTimetable(data: unknown): Lesson[] {
  const lessons: Lesson[] = []
  for (const raw of objects(data)) {
    const start = pickDateTime(raw, 'start_date', 'startDate', 'debut')
    const end = pickDateTime(raw, 'end_date', 'endDate', 'fin')
    if (!start || !end) continue
    const id = pickText(raw, 'id') || `${start}-${pickText(raw, 'matiere', 'text')}`
    lessons.push({
      id,
      subject: pickText(raw, 'matiere', 'text', 'libelle'),
      teacher: pickText(raw, 'prof', 'professeur'),
      room: pickText(raw, 'salle'),
      start,
      end,
      canceled: pickBool(raw, ['isAnnule', 'annule']),
      exam: pickBool(raw, ['isDevoir', 'devoir', 'interrogation']),
      note: pickText(raw, 'note', 'commentaire'),
      group: pickText(raw, 'libelleGroupe', 'groupe', 'groupeCode'),
      kind: pickText(raw, 'typeCours', 'type'),
      previousRoom: pickText(raw, 'previousRoom') || undefined,
      previousStart: pickDateTime(raw, 'previousStart') || undefined,
    })
  }
  // Le service ne garantit pas l'ordre, et un emploi du temps désordonné est illisible.
  return lessons.sort((left, right) => left.start.localeCompare(right.start))
}
