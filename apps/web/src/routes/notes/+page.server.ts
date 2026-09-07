import type { PageServerLoad } from './$types'
import { generalAverage, requiredGrade, simulate } from '@ecole2recte/protocol'
import { loadSections, today } from '$lib/server/api.js'
import { requireStudent } from '$lib/server/guard.js'

export const load: PageServerLoad = async ({ locals, url }) => {
  const { id, record, account } = requireStudent(locals)
  const jour = today()
  const { snapshot, errors } = await loadSections(id, record, account, ['grades'], { today: jour })

  const demande = url.searchParams.get('periode')
  const periode =
    snapshot.periods.find((entry) => entry.code === demande) ??
    snapshot.periods.find((entry) => entry.current) ??
    snapshot.periods[0] ??
    null

  const code = periode?.code ?? ''
  const notes = snapshot.grades.filter((note) => note.periodCode === code)
  const moyennes = snapshot.subjectAverages.filter((entry) => entry.periodCode === code)

  // La moyenne de l'établissement prime sur celle qu'on calculerait : tous les coefficients
  // ne sont pas exposés, et une moyenne calculée doit s'annoncer comme telle.
  const generale = generalAverage(periode?.average, snapshot.grades, code)

  // Le simulateur répond à la question posée dans l'URL, donc partageable et rechargeable.
  const valeur = Number(url.searchParams.get('note') ?? '')
  const matiere = url.searchParams.get('matiere') ?? undefined
  const objectif = Number(url.searchParams.get('objectif') ?? '')

  return {
    jour,
    periodes: snapshot.periods,
    periode,
    notes,
    moyennes,
    generale,
    erreur: errors.grades ?? null,
    simulation: Number.isFinite(valeur)
      ? simulate(snapshot.grades, code, { subject: matiere, value: valeur })
      : null,
    vise: Number.isFinite(objectif)
      ? requiredGrade(snapshot.grades, code, { subject: matiere, target: objectif })
      : null,
    matiere: matiere ?? '',
  }
}
