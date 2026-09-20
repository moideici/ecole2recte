import type { PageServerLoad } from './$types'
import { type MessageFolder, MESSAGE_FOLDERS, counterpart } from '@ecole2recte/protocol'
import { persist, teacherFor, today } from '$lib/server/api.js'
import { requireTeacher } from '$lib/server/guard.js'

/**
 * La messagerie enseignant, en lecture : la même page que celle des élèves, sur l'hôte
 * enseignant. La page est demandée au serveur plutôt que gardée en cache, parce que la
 * pagination est celle du service.
 */
export const load: PageServerLoad = async ({ locals, url }) => {
  const { id, record, account } = requireTeacher(locals)
  const demande = url.searchParams.get('dossier') as MessageFolder | null
  const dossier: MessageFolder = demande && MESSAGE_FOLDERS.includes(demande) ? demande : 'received'
  const page = Math.max(0, Number(url.searchParams.get('page') ?? '0') || 0)

  const { api } = teacherFor(record, id)
  const result = await api.messages(account, { folder: dossier, page })
  await persist(id, record)

  const messages = result.ok ? result.value.messages : []
  return {
    jour: today(),
    dossier,
    page,
    messages: messages.map((message) => ({ ...message, interlocuteur: counterpart(message) })),
    erreur: result.ok ? null : result,
  }
}
