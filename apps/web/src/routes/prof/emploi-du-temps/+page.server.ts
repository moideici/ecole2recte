import type { PageServerLoad } from './$types'
import { addDays, gaps, lessonsOn, minutesBetween, startOfWeek } from '@ecole2recte/protocol'
import { cached, nowLocal, teacherFor, today } from '$lib/server/api.js'
import { requireTeacher } from '$lib/server/guard.js'

export const load: PageServerLoad = async ({ locals, url }) => {
  const { id, record, account } = requireTeacher(locals)
  const { api } = teacherFor(record)
  const jour = today()

  // La date consultée vit dans l'URL : un emploi du temps se partage, se recharge et se met
  // en favori.
  const demande = url.searchParams.get('jour')
  const selection = demande && /^\d{4}-\d{2}-\d{2}$/.test(demande) ? demande : jour
  const debutSemaine = startOfWeek(selection)
  const finSemaine = addDays(debutSemaine, 6)

  const result = await cached(id, record, `edt:${debutSemaine}:${finSemaine}`, () =>
    api.timetable(account, debutSemaine, finSemaine),
  )
  // Le professeur de chaque cours, c'est soi : on ne le répète pas.
  const cours = result.ok ? result.value.map((lesson) => ({ ...lesson, teacher: '' })) : []

  const semaine = Array.from({ length: 6 }, (_, index) => {
    const date = addDays(debutSemaine, index)
    const tenus = lessonsOn(cours, date).filter((lesson) => !lesson.canceled)
    return {
      date,
      cours: tenus.length,
      minutes: tenus.reduce((total, lesson) => total + minutesBetween(lesson.start, lesson.end), 0),
    }
  })
  const duJour = lessonsOn(cours, selection)

  return {
    jour,
    maintenant: nowLocal(),
    selection,
    debutSemaine,
    semaine,
    duJour,
    trous: gaps(duJour),
    erreur: result.ok ? null : result.message,
  }
}
