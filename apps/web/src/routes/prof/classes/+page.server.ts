import type { PageServerLoad } from './$types'
import { groupKey } from '@ecole2recte/protocol'
import { CATALOGUE_TTL_MS, cached, teacherFor, today } from '$lib/server/api.js'
import { requireTeacher } from '$lib/server/guard.js'

export const load: PageServerLoad = async ({ locals }) => {
  const { id, record, account } = requireTeacher(locals)
  const { api } = teacherFor(record, id)
  const jour = today()
  const catalogue = await cached(id, record, 'catalogue', () => api.catalog(account), CATALOGUE_TTL_MS)

  if (catalogue.ok) {
    return {
      erreur: null,
      groupes: catalogue.value.groups.map((groupe) => {
        const actuelle = groupe.periods.find(
          (periode) => periode.start !== undefined && periode.end !== undefined && periode.start <= jour && jour <= periode.end,
        )
        return {
          cle: groupKey(groupe),
          libelle: groupe.label,
          code: groupe.code,
          type: groupe.kind,
          pp: groupe.headTeacher,
          notee: groupe.periods.some((periode) => periode.subjects.some((matiere) => matiere.graded)),
          periode: actuelle?.label ?? '',
        }
      }),
    }
  }

  // Sans catalogue, le profil du login donne encore la liste : moins riche, mais juste.
  const profil = account.teacher
  return {
    erreur: catalogue.message,
    groupes: [...(profil?.classes ?? []), ...(profil?.groups ?? [])].map((groupe) => ({
      cle: groupKey(groupe),
      libelle: groupe.label,
      code: groupe.code,
      type: groupe.kind,
      pp: false,
      notee: false,
      periode: '',
    })),
  }
}
