import type { PageServerLoad } from './$types'
import { type MessageFolder, MESSAGE_FOLDERS, counterpart } from '@ecole2recte/protocol'
import { clientFor, today } from '$lib/server/api.js'
import { persist } from '$lib/server/api.js'
import { requireStudent } from '$lib/server/guard.js'

/**
 * La messagerie, en lecture.
 *
 * Les dossiers « envoyés » et « archivés » ne se chargent qu'à leur ouverture : les charger
 * tous les trois d'avance triplerait le temps d'attente pour rien. La page est demandée au
 * serveur plutôt que gardée en cache, parce que la pagination est celle du service.
 */
export const load: PageServerLoad = async ({ locals, url }) => {
  const { id, record, account } = requireStudent(locals)
  const demande = url.searchParams.get('dossier') as MessageFolder | null
  const dossier: MessageFolder = demande && MESSAGE_FOLDERS.includes(demande) ? demande : 'received'
  const page = Math.max(0, Number(url.searchParams.get('page') ?? '0') || 0)

  const { api } = clientFor(record, id)
  const result = await api.messages(account, { folder: dossier, page })
  await persist(id, record)

  const messages = result.ok ? result.value.messages : []
  return {
    jour: today(),
    dossier,
    page,
    messages: messages.map((message) => ({ ...message, interlocuteur: counterpart(message) })),
    total: result.ok ? (result.value.total ?? null) : null,
    erreur: result.ok ? null : result,
  }
}
