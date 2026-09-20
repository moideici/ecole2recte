import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import {
  type Grade,
  type Period,
  addDays,
  currentLesson,
  dateOf,
  dayProgress,
  gaps,
  generalAverage,
  lessonsOn,
  nextLesson,
  pendingHomework,
  reconcileSubjectAverages,
  startOfWeek,
  unjustifiedAbsences,
  unreadMessages,
  upcomingExams,
} from '@ecole2recte/protocol'
import {
  COOKIE_ACCUEIL,
  DISPOSITION_PAR_DEFAUT,
  ecrireDisposition,
  exigeLaJournee,
  lireDisposition,
  sectionsPour,
  widget,
} from '$lib/accueil.js'
import { loadDays, loadSections, nowLocal, persist, today } from '$lib/server/api.js'
import { requireAccount, requireStudent } from '$lib/server/guard.js'

/**
 * L'accueil.
 *
 * Il n'a plus de contenu à lui : c'est une disposition de widgets, choisie par la personne
 * et gardée dans un cookie. Le cookie plutôt qu'un stockage de navigateur, pour une raison
 * précise : **le serveur doit connaître la disposition avant de charger quoi que ce soit**.
 * Sans elle, il faudrait tout charger puis en jeter la moitié, et la page clignoterait le
 * temps que le navigateur remette les tuiles dans l'ordre.
 */
export const load: PageServerLoad = async ({ locals, url, cookies }) => {
  const { id, record, account } = requireStudent(locals)
  const jour = today()
  const maintenant = nowLocal()
  const force = url.searchParams.get('rafraichir') === '1'

  const disposition = lireDisposition(cookies.get(COOKIE_ACCUEIL))
  const sections = sectionsPour(disposition)

  // Une liste vide ne déclenche aucun appel : un accueil sans tuile ne réveille pas le service.
  const { snapshot, errors } = await loadSections(id, record, account, sections, { today: jour, force })

  const duJour = lessonsOn(snapshot.lessons, jour)
  const suivant = nextLesson(snapshot.lessons, maintenant)
  const enCours = currentLesson(snapshot.lessons, maintenant)

  // Quand la journée est finie — ou qu'il n'y a pas cours — la prochaine journée d'école est
  // plus utile qu'une liste vide.
  const prochaineJournee = suivant && dateOf(suivant.start) !== jour ? dateOf(suivant.start) : null
  const journeeAffichee = duJour.length > 0 ? jour : (prochaineJournee ?? jour)
  const coursAffiches = duJour.length > 0 ? duJour : prochaineJournee ? lessonsOn(snapshot.lessons, prochaineJournee) : []

  const aFaire = pendingHomework(snapshot.homework, jour).slice(0, 6)
  const evaluations = upcomingExams(snapshot.homework, jour).slice(0, 4)

  // Les énoncés ne sont pas dans le résumé du cahier de textes : ils se chargent par journée,
  // et seulement si un widget les demande.
  const jours = exigeLaJournee(disposition)
    ? await loadDays(id, record, account, [journeeAffichee, ...aFaire.map((item) => item.dueDate)])
    : {}
  const enonce = (item: { id: string; subject: string; dueDate: string; content: string }) =>
    item.content ||
    jours[item.dueDate]?.homework.find(
      (entry) => entry.id === item.id || (entry.subject === item.subject && entry.content !== ''),
    )?.content ||
    ''

  // La moyenne de la période en cours, arbitrée comme sur la page des notes : l'accueil ne
  // doit pas annoncer un chiffre que le relevé contredirait deux clics plus loin.
  const periode: Period | null = snapshot.periods.find((entry) => entry.current) ?? snapshot.periods[0] ?? null
  const code = periode?.code ?? ''
  const moyenne = generalAverage(periode?.average, snapshot.grades, code, snapshot.subjectAverages)

  const matieres = reconcileSubjectAverages(snapshot.subjectAverages, snapshot.grades, code)
    .filter((entry) => entry.verdict.value !== undefined && entry.average.parentSubject === '')
    .map((entry) => ({
      subject: entry.average.subject,
      moyenne: entry.verdict.value as number,
      classe: entry.average.classAverage ?? null,
      recalculee: entry.verdict.origin === 'recomputed',
    }))
    .sort((gauche, droite) => droite.moyenne - gauche.moyenne)

  // La suite des périodes déjà notées : une moyenne seule ne dit pas si ça monte.
  const progression = snapshot.periods
    .map((entry) => ({
      nom: entry.name,
      valeur: generalAverage(entry.average, snapshot.grades, entry.code, snapshot.subjectAverages).value ?? null,
    }))
    .filter((entree): entree is { nom: string; valeur: number } => entree.valeur !== null)

  // La semaine affichée par le widget « La semaine » : les six jours d'école autour d'aujourd'hui.
  const lundi = startOfWeek(jour)
  const semaineGrille = Array.from({ length: 6 }, (_, index) => {
    const date = addDays(lundi, index)
    return { date, lecons: lessonsOn(snapshot.lessons, date) }
  })

  const semaine = snapshot.homework.filter((item) => item.dueDate >= jour)
  const derniers: Grade[] = snapshot.grades.filter((note) => note.periodCode === code).slice(0, 5)

  return {
    jour,
    maintenant,
    disposition,
    erreurs: errors,
    // — la journée
    enCours,
    suivant,
    avancement: dayProgress(duJour, maintenant),
    journeeAffichee,
    coursAffiches,
    demain: prochaineJournee,
    trous: gaps(coursAffiches),
    semaineGrille,
    // — le travail
    aFaire: aFaire.map((item) => ({ ...item, content: enonce(item) })),
    evaluations,
    faits: semaine.filter((item) => item.done).length,
    aRendre: semaine.length,
    seances: jours[journeeAffichee]?.sessions ?? [],
    // — les notes
    periode,
    moyenne,
    matieres,
    progression,
    derniers,
    // — le reste
    nonLus: unreadMessages(snapshot.messages).slice(0, 4),
    nonLusTotal: unreadMessages(snapshot.messages).length,
    absences: unjustifiedAbsences(snapshot.schoolLife).length,
    vieScolaire: snapshot.schoolLife.slice(0, 3),
    actualites: snapshot.news.slice(0, 2),
    documents: snapshot.documents.slice(0, 3),
    manuels: snapshot.textbooks.slice(0, 4),
    fichiers: snapshot.cloudFiles.filter((entree) => entree.file).slice(0, 3),
  }
}

/** La disposition est posée pour un an sur cet appareil : ce n'est pas une donnée scolaire. */
function poser(cookies: import('@sveltejs/kit').Cookies, ids: string[], url: URL): void {
  cookies.set(COOKIE_ACCUEIL, ecrireDisposition(ids), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: url.protocol === 'https:',
    maxAge: 365 * 24 * 60 * 60,
  })
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
    await persist(id, record)
    redirect(303, '/')
  },

  /**
   * La disposition de l'accueil.
   *
   * Tout passe par un formulaire, y compris les flèches : la page se réordonne donc sans une
   * ligne de JavaScript, et les cases cochées ne sont pas perdues en chemin.
   */
  disposition: async ({ request, cookies, url, locals }) => {
    requireStudent(locals)
    const form = await request.formData()

    if (form.get('reinitialiser') !== null) {
      poser(cookies, DISPOSITION_PAR_DEFAUT, url)
      redirect(303, '/?personnaliser=1')
    }

    const actifs = form.getAll('actif').map(String).filter((id) => widget(id) !== undefined)
    // L'ordre d'arrivée est celui du formulaire ; on le réordonne selon la liste courante,
    // puis on déplace la tuile demandée.
    const courant = lireDisposition(cookies.get(COOKIE_ACCUEIL))
    const ordonnes = [
      ...courant.filter((id) => actifs.includes(id)),
      ...actifs.filter((id) => !courant.includes(id)),
    ]

    const monter = String(form.get('monter') ?? '')
    const descendre = String(form.get('descendre') ?? '')
    const bouge = monter || descendre
    if (bouge) {
      const index = ordonnes.indexOf(bouge)
      const cible = index + (monter ? -1 : 1)
      if (index >= 0 && cible >= 0 && cible < ordonnes.length) {
        ;[ordonnes[index], ordonnes[cible]] = [ordonnes[cible] as string, ordonnes[index] as string]
      }
    }

    poser(cookies, ordonnes, url)
    redirect(303, '/?personnaliser=1')
  },
}
