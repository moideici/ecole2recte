import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { groupKey, parseGroupKey } from '@ecole2recte/protocol'
import { CATALOGUE_TTL_MS, cached, teacherFor, today } from '$lib/server/api.js'
import { requireTeacher } from '$lib/server/guard.js'

export const load: PageServerLoad = async ({ locals, params }) => {
  const { id, record, account } = requireTeacher(locals)
  const cible = parseGroupKey(params.groupe)
  if (!cible) error(404, 'Classe inconnue.')

  const { api } = teacherFor(record, id)
  const catalogue = await cached(id, record, 'catalogue', () => api.catalog(account), CATALOGUE_TTL_MS)
  const duCatalogue = catalogue.ok
    ? catalogue.value.groups.find((groupe) => groupKey(groupe) === params.groupe)
    : undefined
  const duProfil = [...(account.teacher?.classes ?? []), ...(account.teacher?.groups ?? [])].find(
    (groupe) => groupKey(groupe) === params.groupe,
  )
  // Une adresse ne suffit pas à ouvrir une classe : elle doit être l'une de celles du professeur.
  const connu = duCatalogue ?? duProfil
  if (!connu) error(404, 'Cette classe ne fait pas partie des vôtres.')

  const result = await cached(id, record, `eleves:${params.groupe}`, () => api.pupils(cible))
  const jour = today()
  const tous = result.ok ? result.value : []
  // Un élève parti reste dans la réponse du service ; il n'a plus sa place dans la liste.
  const eleves = tous.filter((eleve) => !eleve.leftOn || eleve.leftOn > jour)

  return {
    groupe: {
      cle: params.groupe,
      libelle: connu.label,
      type: connu.kind,
      pp: duCatalogue?.headTeacher ?? false,
      notee: duCatalogue ? duCatalogue.periods.some((periode) => periode.subjects.some((matiere) => matiere.graded)) : false,
    },
    eleves,
    effectifs: {
      filles: eleves.filter((eleve) => eleve.sex === 'F').length,
      garcons: eleves.filter((eleve) => eleve.sex === 'M').length,
      accompagnes: eleves.filter((eleve) => eleve.supports.length > 0).length,
      dispenses: eleves.filter((eleve) => eleve.dispensed).length,
      partis: tous.length - eleves.length,
    },
    erreur: result.ok ? null : result.message,
  }
}
