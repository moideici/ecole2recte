import type { PageServerLoad } from './$types'
import { loadSections, today } from '$lib/server/api.js'
import { requireAccount } from '$lib/server/guard.js'

export const load: PageServerLoad = async ({ locals }) => {
  const { id, record, account } = requireAccount(locals)
  const { snapshot, errors } = await loadSections(id, record, account, ['news'], { today: today() })
  return { actualites: snapshot.news, erreur: errors.news ?? null }
}
