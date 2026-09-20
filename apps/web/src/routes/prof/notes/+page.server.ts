import type { PageServerLoad } from './$types'
import { assessmentStats, groupAverage, groupKey, pupilAverage } from '@ecole2recte/protocol'
import { CATALOGUE_TTL_MS, cached, teacherFor, today } from '$lib/server/api.js'
import { requireTeacher } from '$lib/server/guard.js'

interface Grille {
  evaluations: Array<{
    id: string
    libelle: string
    date: string | null
    coefficient: number
    bareme: number
    compte: boolean
    type: string
    moyenne: number | null
  }>
  lignes: Array<{
    id: string
    nom: string
    prenom: string
    classe: string
    notes: Array<{ ecrit: string; commentaire: string } | null>
    moyenne: number | null
  }>
  moyenne: number | null
}

/**
 * Les notes, en lecture.
 *
 * Une grille se demande par classe, période et matière, et ces trois codes ne viennent que du
 * catalogue : les choix proposés sont les siens, jamais une saisie libre. Les moyennes sont
 * calculées ici à partir de la grille ; celles du bulletin suivent les règles de
 * l'établissement et peuvent différer.
 */
export const load: PageServerLoad = async ({ locals, url }) => {
  const { id, record, account } = requireTeacher(locals)
  const { api } = teacherFor(record, id)
  const jour = today()
  const catalogue = await cached(id, record, 'catalogue', () => api.catalog(account), CATALOGUE_TTL_MS)

  const groupes = catalogue.ok
    ? catalogue.value.groups.filter((groupe) => groupe.periods.some((periode) => periode.subjects.some((matiere) => matiere.graded)))
    : []
  const groupe = groupes.find((entree) => groupKey(entree) === url.searchParams.get('groupe')) ?? groupes[0]

  const periodes = groupe ? groupe.periods.filter((periode) => periode.subjects.some((matiere) => matiere.graded)) : []
  // Sans choix explicite, la période qui contient aujourd'hui, puis la première ouverte.
  const periode =
    periodes.find((entree) => entree.code === url.searchParams.get('periode')) ??
    periodes.find((entree) => entree.start !== undefined && entree.end !== undefined && entree.start <= jour && jour <= entree.end) ??
    periodes.find((entree) => entree.open) ??
    periodes[0]

  const matieres = periode ? periode.subjects.filter((matiere) => matiere.graded) : []
  const matiere = matieres.find((entree) => entree.code === url.searchParams.get('matiere')) ?? matieres[0]

  let grille: Grille | null = null
  let erreur: string | null = catalogue.ok ? null : catalogue.message

  if (groupe && periode && matiere) {
    const result = await cached(id, record, `notes:${groupKey(groupe)}:${periode.code}:${matiere.code}`, () =>
      api.gradebook(account, groupe, periode.code, matiere.code),
    )
    if (result.ok) {
      const carnet = result.value
      grille = {
        evaluations: carnet.assessments.map((evaluation) => ({
          id: evaluation.id,
          libelle: evaluation.label,
          date: evaluation.date ?? null,
          coefficient: evaluation.coefficient,
          bareme: evaluation.scale,
          compte: evaluation.counted,
          type: evaluation.kind,
          moyenne: assessmentStats(carnet, evaluation.id).average ?? null,
        })),
        lignes: carnet.rows.map((ligne) => ({
          id: ligne.pupil.id,
          nom: ligne.pupil.lastName,
          prenom: ligne.pupil.firstName,
          classe: ligne.pupil.className,
          notes: carnet.assessments.map((evaluation) => {
            const note = ligne.marks[evaluation.id]
            return note ? { ecrit: note.raw, commentaire: note.comment } : null
          }),
          moyenne: pupilAverage(carnet, ligne.pupil.id) ?? null,
        })),
        moyenne: groupAverage(carnet) ?? null,
      }
    } else {
      erreur = result.message
    }
  }

  return {
    erreur,
    groupes: groupes.map((entree) => ({ cle: groupKey(entree), libelle: entree.label })),
    periodes: periodes.map((entree) => ({ code: entree.code, libelle: entree.label, ouverte: entree.open })),
    matieres: matieres.map((entree) => ({ code: entree.code, libelle: entree.label })),
    selection: {
      groupe: groupe ? groupKey(groupe) : '',
      periode: periode?.code ?? '',
      matiere: matiere?.code ?? '',
      libelle: groupe?.label ?? '',
    },
    grille,
  }
}
