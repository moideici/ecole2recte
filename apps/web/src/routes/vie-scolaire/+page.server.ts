import type { PageServerLoad } from './$types'
import { loadSections, today } from '$lib/server/api.js'
import { requireAccount } from '$lib/server/guard.js'

export const load: PageServerLoad = async ({ locals }) => {
  const { id, record, account } = requireAccount(locals)
  const jour = today()
  const { snapshot, errors } = await loadSections(id, record, account, ['schoolLife'], { today: jour })
  const evenements = snapshot.schoolLife
  return {
    jour,
    evenements,
    compteurs: {
      absences: evenements.filter((entry) => entry.kind === 'absence').length,
      nonJustifiees: evenements.filter((entry) => entry.kind === 'absence' && !entry.justified).length,
      retards: evenements.filter((entry) => entry.kind === 'late').length,
      sanctions: evenements.filter((entry) => entry.kind === 'sanction').length,
      encouragements: evenements.filter((entry) => entry.kind === 'encouragement').length,
    },
    erreur: errors.schoolLife ?? null,
  }
}
