import type { PageServerLoad } from './$types'
import { addDays, groupKey, startOfWeek } from '@ecole2recte/protocol'
import { cached, teacherFor, today } from '$lib/server/api.js'
import { requireTeacher } from '$lib/server/guard.js'

/**
 * Le cahier de textes de la semaine, en lecture : ce qui a été fait en séance et ce qui a été
 * donné à faire, classe par classe.
 */
export const load: PageServerLoad = async ({ locals, url }) => {
  const { id, record } = requireTeacher(locals)
  const { api } = teacherFor(record, id)
  const jour = today()

  const demande = url.searchParams.get('semaine')
  const debut = startOfWeek(demande && /^\d{4}-\d{2}-\d{2}$/.test(demande) ? demande : jour)
  const fin = addDays(debut, 6)
  const result = await cached(id, record, `cdt:${debut}`, () => api.lessonSlots(debut, fin))
  const seances = result.ok ? result.value : []

  const groupes = new Map<string, string>()
  for (const seance of seances) groupes.set(groupKey(seance.group), seance.group.label)

  const groupe = url.searchParams.get('groupe') ?? ''
  const visibles = groupe === '' ? seances : seances.filter((seance) => groupKey(seance.group) === groupe)
  const dates = [...new Set(visibles.map((seance) => seance.date))].sort()

  return {
    jour,
    debut,
    semaineCourante: startOfWeek(jour),
    groupe,
    groupes: [...groupes].map(([cle, libelle]) => ({ cle, libelle })).sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr')),
    jours: dates.map((date) => ({ date, seances: visibles.filter((seance) => seance.date === date) })),
    total: visibles.length,
    erreur: result.ok ? null : result.message,
  }
}
