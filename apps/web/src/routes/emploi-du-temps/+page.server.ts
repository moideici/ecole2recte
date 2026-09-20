import type { PageServerLoad } from './$types'
import { addDays, dateOf, gaps, lessonsOn, startOfWeek } from '@ecole2recte/protocol'
import { loadSections, nowLocal, today } from '$lib/server/api.js'
import { requireStudent } from '$lib/server/guard.js'

/** Les minutes depuis minuit d'un instant local `2026-09-07T10:15:00`. */
function minutes(instant: string): number {
  return Number(instant.slice(11, 13)) * 60 + Number(instant.slice(14, 16))
}

export const load: PageServerLoad = async ({ locals, url }) => {
  const { id, record, account } = requireStudent(locals)
  const jour = today()
  const { snapshot, errors } = await loadSections(id, record, account, ['timetable', 'homework'], { today: jour })

  // La date consultée vit dans l'URL : un emploi du temps se partage, se recharge et se
  // met en favori. Un état local ne survivrait à aucun des trois.
  const demande = url.searchParams.get('jour')
  const selection = demande && /^\d{4}-\d{2}-\d{2}$/.test(demande) ? demande : jour
  const debutSemaine = startOfWeek(selection)
  // La vue aussi : revenir sur la semaine après avoir suivi un lien doit rendre la semaine.
  const vue = url.searchParams.get('vue') === 'jour' ? 'jour' : 'semaine'

  const semaine = Array.from({ length: 6 }, (_, index) => {
    const date = addDays(debutSemaine, index)
    const cours = lessonsOn(snapshot.lessons, date)
    const actifs = cours.filter((lesson) => !lesson.canceled)
    return {
      date,
      cours: actifs.length,
      minutes: actifs.reduce((total, lesson) => total + (minutes(lesson.end) - minutes(lesson.start)), 0),
      // La grille a besoin des cours eux-mêmes, pas seulement de leur nombre.
      lecons: cours,
    }
  })

  // Les bornes de la grille suivent la semaine affichée : une semaine sans cours l'après-midi
  // ne doit pas dessiner quatre heures de vide.
  const tous = semaine.flatMap((entree) => entree.lecons)
  const debut = tous.length === 0 ? 8 * 60 : Math.min(...tous.map((lesson) => minutes(lesson.start)))
  const fin = tous.length === 0 ? 18 * 60 : Math.max(...tous.map((lesson) => minutes(lesson.end)))

  const duJour = lessonsOn(snapshot.lessons, selection)

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
    // Les devoirs à rendre s'affichent dans la case du cours concerné : c'est là qu'on les
    // cherche, pas dans une autre page.
    devoirsDuJour: snapshot.homework.filter((item) => item.dueDate === selection),
    devoirsSemaine: snapshot.homework
      .filter((item) => item.dueDate >= debutSemaine && item.dueDate <= addDays(debutSemaine, 5))
      .map((item) => ({ id: item.id, subject: item.subject, dueDate: item.dueDate, exam: item.exam })),
    erreur: errors.timetable ?? null,
    aujourdhui: dateOf(jour),
  }
}
