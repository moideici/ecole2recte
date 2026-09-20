import type { PageServerLoad } from './$types'
import {
  addDays,
  counterpart,
  currentLesson,
  dateOf,
  groupKey,
  lessonsOn,
  nextLesson,
  startOfWeek,
  unreadMessages,
} from '@ecole2recte/protocol'
import { CLE_MESSAGES_ACCUEIL, cached, nowLocal, teacherFor, today } from '$lib/server/api.js'
import { requireTeacher } from '$lib/server/guard.js'

/**
 * L'accueil du professeur.
 *
 * Ce qu'on veut savoir en trois secondes entre deux cours : où l'on doit être, avec qui, et
 * ce qui attend d'être lu. Tout le reste a sa page.
 */
export const load: PageServerLoad = async ({ locals }) => {
  const { id, record, account } = requireTeacher(locals)
  const { api } = teacherFor(record)
  const jour = today()
  const maintenant = nowLocal()
  const debut = startOfWeek(jour)
  // Deux semaines : le vendredi soir, le prochain cours est la semaine suivante.
  const fin = addDays(debut, 13)

  const [edt, messages] = await Promise.all([
    cached(id, record, `edt:${debut}:${fin}`, () => api.timetable(account, debut, fin)),
    cached(id, record, CLE_MESSAGES_ACCUEIL, () => api.messages(account, { folder: 'received' }), 60 * 1000),
  ])

  // Le professeur de chaque cours, c'est soi : on ne le répète pas.
  const cours = edt.ok ? edt.value.map((lesson) => ({ ...lesson, teacher: '' })) : []
  const duJour = lessonsOn(cours, jour)
  const suivant = nextLesson(cours, maintenant) ?? null
  const prochaineJournee = duJour.length === 0 && suivant ? dateOf(suivant.start) : null
  const nonLus = messages.ok ? unreadMessages(messages.value.messages) : []
  const profil = account.teacher

  return {
    jour,
    maintenant,
    prenom: account.firstName,
    enCours: currentLesson(cours, maintenant) ?? null,
    suivant,
    duJour,
    prochaineJournee,
    prochainsCours: prochaineJournee ? lessonsOn(cours, prochaineJournee) : [],
    nonLus: nonLus.slice(0, 4).map((message) => ({ ...message, interlocuteur: counterpart(message) })),
    nonLusTotal: nonLus.length,
    classes: [...(profil?.classes ?? []), ...(profil?.groups ?? [])].map((groupe) => ({
      cle: groupKey(groupe),
      libelle: groupe.label,
    })),
    erreurs: { edt: edt.ok ? null : edt.message, messages: messages.ok ? null : messages.message },
  }
}
