import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { type MessageFolder, MESSAGE_FOLDERS } from '@ecole2recte/protocol'
import { CLE_MESSAGES_ACCUEIL, persist, teacherFor, today } from '$lib/server/api.js'
import { requireTeacher } from '$lib/server/guard.js'

export const load: PageServerLoad = async ({ locals, params, url }) => {
  const { id, record, account } = requireTeacher(locals)
  if (!/^\d+$/.test(params.id)) error(404, 'Message inconnu.')
  const demande = url.searchParams.get('dossier') as MessageFolder | null
  const dossier: MessageFolder = demande && MESSAGE_FOLDERS.includes(demande) ? demande : 'received'

  const { api } = teacherFor(record, id)
  // Cet appel est celui du site : il marque aussi le message lu côté ÉcoleDirecte, et le
  // compte de messages non lus gardé pour l'accueil n'est donc plus juste.
  const result = await api.messageDetail(account, params.id, dossier, today())
  if (record.cache) delete record.cache[CLE_MESSAGES_ACCUEIL]
  await persist(id, record)
  if (!result.ok) error(result.kind === 'access-denied' ? 403 : 502, result.message)

  return { dossier, message: result.value }
}
