import type { SchoolLifeEvent, SchoolLifeKind } from '../models.js'
import { type Json, asObject, objects, pickBool, pickDateTime, pickText } from './json.js'

/**
 * La vie scolaire.
 *
 * La durée est reprise **telle que l'établissement la compte** et non recalculée : une
 * absence de 8 h à 10 h peut valoir une heure de cours ou deux selon l'emploi du temps, et
 * c'est le décompte de l'établissement qui fait foi devant les parents.
 */
const KINDS: Record<string, SchoolLifeKind> = {
  absence: 'absence',
  retard: 'late',
  sanction: 'sanction',
  encouragement: 'encouragement',
}

function kindOf(raw: Json): SchoolLifeKind {
  const label = pickText(raw, 'typeElement', 'type').toLowerCase()
  for (const [needle, kind] of Object.entries(KINDS)) {
    if (label.includes(needle)) return kind
  }
  return 'other'
}

export function parseSchoolLife(data: unknown): SchoolLifeEvent[] {
  const root = asObject(data)
  if (!root) return []
  const events: SchoolLifeEvent[] = []
  for (const key of ['absencesRetards', 'sanctionsEncouragements', 'evenements']) {
    for (const raw of objects(root[key])) {
      const start = pickDateTime(raw, 'date', 'dateDebut', 'displayDate')
      if (!start) continue
      const event: SchoolLifeEvent = {
        id: pickText(raw, 'id') || `${key}-${start}`,
        kind: kindOf(raw),
        label: pickText(raw, 'libelle', 'typeElement'),
        start,
        justified: pickBool(raw, ['justifie', 'justifiee']),
        reason: pickText(raw, 'motif', 'parMotif'),
        comment: pickText(raw, 'commentaire'),
        duration: pickText(raw, 'displayDate', 'duree'),
      }
      const end = pickDateTime(raw, 'dateFin')
      if (end) event.end = end
      events.push(event)
    }
  }
  return events.sort((left, right) => right.start.localeCompare(left.start))
}
