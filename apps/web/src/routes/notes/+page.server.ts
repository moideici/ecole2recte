import type { PageServerLoad } from './$types'
import {
  type SubjectAverage,
  averageSeries,
  averageOfSubjects,
  generalAverage,
  reconcileSubjectAverages,
  requiredGrade,
  simulate,
} from '@ecole2recte/protocol'
import { loadSections, today } from '$lib/server/api.js'
import { requireStudent } from '$lib/server/guard.js'

/** Une matière sans moyenne publiée, pour que ses notes ne disparaissent pas du relevé. */
function matiereImplicite(periodCode: string, subject: string): SubjectAverage {
  return { periodCode, subject, teacher: '', teachers: [], appreciation: '', parentSubject: '' }
}

function nombre(valeur: string | null): number | undefined {
  if (valeur === null || valeur.trim() === '') return undefined
  const lu = Number(valeur.replace(',', '.'))
  return Number.isFinite(lu) ? lu : undefined
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

  // Le simulateur répond à la question posée dans l'URL, donc partageable et rechargeable.
  // Il porte toujours sur une matière : « quelle note viser, toutes matières confondues »
  // n'a pas de réponse, puisqu'on ne passe pas un devoir dans toutes les matières.
  const matiere = url.searchParams.get('matiere') ?? matieres[0]?.subject ?? ''
  const valeur = nombre(url.searchParams.get('note'))
  const objectif = nombre(url.searchParams.get('objectif'))
  const simulation = valeur !== undefined && matiere !== '' ? simulate(snapshot.grades, code, { subject: matiere, value: valeur }) : null

  // L'effet sur la moyenne générale : la moyenne de la matière remplacée par celle qu'on
  // aurait, et le reste inchangé. C'est la même pondération que pour l'affichage.
  const generaleApres =
    simulation?.after === undefined
      ? null
      : averageOfSubjects(
          arbitrees.map((entry) =>
            entry.average.subject === matiere
              ? { average: entry.average, verdict: { ...entry.verdict, value: simulation.after } }
              : entry,
          ),
        ) ?? null

  return {
    jour,
    periodes: snapshot.periods,
    periode,
    notes,
    matieres,
    generale,
    courbeGenerale: averageSeries(notes, code, toutes),
    erreur: errors.grades ?? null,
    simulation,
    // Ce qui a été saisi revient dans le formulaire : une page rechargée ne doit pas
    // afficher un résultat au-dessus de champs vides.
    valeur: valeur ?? null,
    objectif: objectif ?? null,
    generaleAvant: averageOfSubjects(arbitrees) ?? null,
    generaleApres,
    vise:
      objectif !== undefined && matiere !== ''
        ? requiredGrade(snapshot.grades, code, { subject: matiere, target: objectif })
        : null,
    matiere,
  }
}
