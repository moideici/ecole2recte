import type { PageServerLoad } from './$types'
import { loadSections, today } from '$lib/server/api.js'
import { requireStudent } from '$lib/server/guard.js'

export const load: PageServerLoad = async ({ locals, url }) => {
  const { id, record, account } = requireStudent(locals)
  const jour = today()
  // « Actualiser » force la relecture : les données dorment cinq minutes en session.
  const force = url.searchParams.get('rafraichir') === '1'
  const { snapshot, errors } = await loadSections(id, record, account, ['schoolLife'], { today: jour, force })
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
