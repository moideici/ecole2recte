import type { PageServerLoad } from './$types'
import { addDays, dateOf, gaps, lessonsOn, startOfWeek } from '@ecole2recte/protocol'
import { loadSections, nowLocal, today } from '$lib/server/api.js'
import { requireStudent } from '$lib/server/guard.js'

export const load: PageServerLoad = async ({ locals, url }) => {
  const { id, record, account } = requireStudent(locals)
  const jour = today()
  const { snapshot, errors } = await loadSections(id, record, account, ['timetable', 'homework'], { today: jour })

  // La date consultée vit dans l'URL : un emploi du temps se partage, se recharge et se
  // met en favori. Un état local ne survivrait à aucun des trois.
  const demande = url.searchParams.get('jour')
  const selection = demande && /^\d{4}-\d{2}-\d{2}$/.test(demande) ? demande : jour
  const debutSemaine = startOfWeek(selection)

  const semaine = Array.from({ length: 6 }, (_, index) => {
    const date = addDays(debutSemaine, index)
    const cours = lessonsOn(snapshot.lessons, date).filter((lesson) => !lesson.canceled)
    return {
      date,
      cours: cours.length,
      minutes: cours.reduce(
        (total, lesson) => total + Math.round((Date.parse(`${lesson.end}Z`) - Date.parse(`${lesson.start}Z`)) / 60000),
        0,
      ),
    }
  })

  const duJour = lessonsOn(snapshot.lessons, selection)

  return {
    jour,
    maintenant: nowLocal(),
    selection,
    debutSemaine,
    semaine,
    duJour,
    trous: gaps(duJour),
    // Les devoirs à rendre s'affichent dans la case du cours concerné : c'est là qu'on les
    // cherche, pas dans une autre page.
    devoirsDuJour: snapshot.homework.filter((item) => item.dueDate === selection),
    erreur: errors.timetable ?? null,
    aujourdhui: dateOf(jour),
  }
}
