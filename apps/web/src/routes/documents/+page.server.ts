import type { PageServerLoad } from './$types'
import { loadSections, today } from '$lib/server/api.js'
import { requireStudent } from '$lib/server/guard.js'

export const load: PageServerLoad = async ({ locals, url }) => {
  const { id, record, account } = requireStudent(locals)
  const jour = today()
  // « Actualiser » force la relecture : les données dorment cinq minutes en session.
  const force = url.searchParams.get('rafraichir') === '1'
  const { snapshot, errors } = await loadSections(id, record, account, ['documents'], { today: jour, force })
  return { documents: snapshot.documents, erreur: errors.documents ?? null }
}
