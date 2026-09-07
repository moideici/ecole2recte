import type { PageServerLoad } from './$types'
import { loadSections, today } from '$lib/server/api.js'
import { requireAccount } from '$lib/server/guard.js'

export const load: PageServerLoad = async ({ locals }) => {
  const { id, record, account } = requireAccount(locals)
  const { snapshot, errors } = await loadSections(id, record, account, ['textbooks'], { today: today() })
  return { manuels: snapshot.textbooks, erreur: errors.textbooks ?? null }
}
