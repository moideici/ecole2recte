import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import {
  currentLesson,
  dateOf,
  dayProgress,
  lessonsOn,
  nextLesson,
  pendingHomework,
  unjustifiedAbsences,
  unreadMessages,
  upcomingExams,
} from '@ecole2recte/protocol'
import { loadSections, nowLocal, today } from '$lib/server/api.js'
import { requireAccount, requireStudent } from '$lib/server/guard.js'
import { persist } from '$lib/server/api.js'

/**
 * L'accueil.
 *
 * Ce qu'on veut savoir en trois secondes : le cours en cours ou le prochain, ce qui est à
 * faire, ce qui a été noté, ce qui attend d'être lu. Le reste a ses propres pages.
 */
export const load: PageServerLoad = async ({ locals }) => {
  const { id, record, account } = requireStudent(locals)
  const jour = today()
  const maintenant = nowLocal()

  const { snapshot, errors } = await loadSections(
    id,
    record,
    account,
    ['timetable', 'homework', 'grades', 'messages', 'schoolLife', 'news'],
    { today: jour },
  )

  const duJour = lessonsOn(snapshot.lessons, jour)
  const suivant = nextLesson(snapshot.lessons, maintenant)
  const enCours = currentLesson(snapshot.lessons, maintenant)

  // Quand la journée est finie — ou qu'il n'y a pas cours — la prochaine journée d'école est
  // plus utile qu'une liste vide.
  const prochaineJournee = suivant && dateOf(suivant.start) !== jour ? dateOf(suivant.start) : null

  return {
    jour,
    maintenant,
    erreurs: errors,
    enCours,
    suivant,
    avancement: dayProgress(duJour, maintenant),
    duJour,
    prochaineJournee,
    prochainsCours: prochaineJournee ? lessonsOn(snapshot.lessons, prochaineJournee) : [],
    aFaire: pendingHomework(snapshot.homework, jour).slice(0, 6),
    evaluations: upcomingExams(snapshot.homework, jour).slice(0, 4),
    dernieresNotes: snapshot.grades.slice(0, 5),
    nonLus: unreadMessages(snapshot.messages).slice(0, 4),
    nonLusTotal: unreadMessages(snapshot.messages).length,
    absences: unjustifiedAbsences(snapshot.schoolLife).length,
    actualites: snapshot.news.slice(0, 2),
  }
}

export const actions: Actions = {
  /** Un compte parent lit plusieurs enfants ; chacun garde son propre cache. */
  changerEnfant: async ({ request, locals }) => {
    const { id, record } = requireAccount(locals)
    const form = await request.formData()
    const enfant = String(form.get('enfant') ?? '')
    if (!record.accounts.some((account) => account.id === enfant)) {
      return fail(400, { message: 'Profil inconnu.' })
    }
    record.activeAccountId = enfant
    persist(id, record)
    redirect(303, '/')
  },
}
