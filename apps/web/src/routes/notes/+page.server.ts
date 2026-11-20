import type { PageServerLoad } from './$types'
import {
  type SubjectAverage,
  averageSeries,
  generalAverage,
  reconcileSubjectAverages,
} from '@ecole2recte/protocol'
import { loadSections, today } from '$lib/server/api.js'
import { requireStudent } from '$lib/server/guard.js'

/** Une matière sans moyenne publiée, pour que ses notes ne disparaissent pas du relevé. */
function matiereImplicite(periodCode: string, subject: string): SubjectAverage {
  return { periodCode, subject, teacher: '', teachers: [], appreciation: '', parentSubject: '' }
}

export const load: PageServerLoad = async ({ locals, url }) => {
  const { id, record, account } = requireStudent(locals)
  const jour = today()
  // « Actualiser » force la relecture : les données dorment cinq minutes en session.
  const force = url.searchParams.get('rafraichir') === '1'
  const { snapshot, errors } = await loadSections(id, record, account, ['grades'], { today: jour, force })

  const demande = url.searchParams.get('periode')
  const periode =
    snapshot.periods.find((entry) => entry.code === demande) ??
    snapshot.periods.find((entry) => entry.current) ??
    snapshot.periods[0] ??
    null

  const code = periode?.code ?? ''
  const notes = snapshot.grades.filter((note) => note.periodCode === code)

  // Une matière notée mais sans moyenne publiée existe : sans cette réunion, ses notes
  // seraient chargées puis jamais montrées.
  const publiees = snapshot.subjectAverages.filter((entry) => entry.periodCode === code)
  const connues = new Set(publiees.map((entry) => entry.subject))
  const implicites = [...new Set(notes.map((note) => note.subject))]
    .filter((subject) => subject !== '' && !connues.has(subject))
    .map((subject) => matiereImplicite(code, subject))
  const toutes = [...publiees, ...implicites]

  const arbitrees = reconcileSubjectAverages(toutes, snapshot.grades, code)
  const matieres = arbitrees.map((entry) => ({
    ...entry.average,
    verdict: entry.verdict,
    courbe: averageSeries(notes, code, toutes, entry.average.subject),
    notes: notes.filter((note) => note.subject === entry.average.subject),
  }))

  // La moyenne de l'établissement prime sur celle qu'on calculerait — sauf quand elle date
  // d'avant des notes déjà saisies : l'afficher reviendrait alors à cacher la dernière note.
  const generale = generalAverage(periode?.average, snapshot.grades, code, toutes)

  return {
    jour,
    periodes: snapshot.periods,
    periode,
    notes,
    matieres,
    generale,
    courbeGenerale: averageSeries(notes, code, toutes),
    erreur: errors.grades ?? null,
  }
}
