import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { type MessageFolder, MESSAGE_FOLDERS } from '@ecole2recte/protocol'
import { clientFor, persist, today } from '$lib/server/api.js'
import { requireAccount } from '$lib/server/guard.js'

export const load: PageServerLoad = async ({ locals, params, url }) => {
  const { id, record, account } = requireAccount(locals)
  const demande = url.searchParams.get('dossier') as MessageFolder | null
  const dossier: MessageFolder = demande && MESSAGE_FOLDERS.includes(demande) ? demande : 'received'

  const { api } = clientFor(record)
  // Cet appel est celui du site : il marque aussi le message lu côté ÉcoleDirecte.
  const result = await api.messageDetail(account, params.id, dossier)
  persist(id, record)
  if (!result.ok) error(result.kind === 'access-denied' ? 403 : 502, result.message)

  return { jour: today(), dossier, message: result.value }
}
