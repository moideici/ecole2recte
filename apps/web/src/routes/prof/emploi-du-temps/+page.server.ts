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

  // La vue aussi vit dans l'URL : revenir sur la semaine après un détour doit rendre la semaine.
  const vue = url.searchParams.get('vue') === 'jour' ? 'jour' : 'semaine'

  const semaine = Array.from({ length: 6 }, (_, index) => {
    const date = addDays(debutSemaine, index)
    const lecons = lessonsOn(cours, date)
    const tenus = lecons.filter((lesson) => !lesson.canceled)
    return {
      date,
      cours: tenus.length,
      minutes: tenus.reduce((total, lesson) => total + minutesBetween(lesson.start, lesson.end), 0),
      // La grille a besoin des cours eux-mêmes, pas seulement de leur nombre.
      lecons,
    }
  })
  const duJour = lessonsOn(cours, selection)

  // Les bornes suivent la semaine affichée : une semaine sans cours le matin ne doit pas
  // dessiner trois heures de vide.
  const tous = semaine.flatMap((entree) => entree.lecons)
  const heure = (instant: string) => Number(instant.slice(11, 13)) * 60 + Number(instant.slice(14, 16))
  const debut = tous.length === 0 ? 8 * 60 : Math.min(...tous.map((lesson) => heure(lesson.start)))
  const fin = tous.length === 0 ? 18 * 60 : Math.max(...tous.map((lesson) => heure(lesson.end)))

  return {
    jour,
    maintenant: nowLocal(),
    selection,
    debutSemaine,
    semaine,
    vue,
    grille: { debut: Math.floor(debut / 60) * 60, fin: Math.ceil(fin / 60) * 60 },
    duJour,
    trous: gaps(duJour),
    erreur: result.ok ? null : result.message,
  }
}
