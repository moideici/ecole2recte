import { error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import type { Attachment, AttachmentSource } from '@ecole2recte/protocol'
import { clientFor, persist } from '$lib/server/api.js'
import { requireAccount } from '$lib/server/guard.js'

import { verifierPieceJointe } from '$lib/pieceJointe.js'

const SOURCES: AttachmentSource[] = ['homework', 'message', 'resource']

/**
 * Le téléchargement d'une pièce jointe.
 *
 * Le fichier transite par le serveur : le navigateur n'a pas le jeton, donc il ne peut pas
 * le demander lui-même. Le nom vient de l'URL et est nettoyé avant d'entrer dans un en-tête
 * `Content-Disposition` — un nom de fichier venu du service ne doit pas pouvoir y injecter
 * de retour à la ligne.
 */
export const GET: RequestHandler = async ({ locals, params, url }) => {
  const { id, record } = requireAccount(locals)
  const source = params.source as AttachmentSource
  if (!SOURCES.includes(source)) error(400, 'Type de pièce jointe inconnu.')

  const nom = (url.searchParams.get('nom') ?? 'document').replace(/[\r\n"\\]/g, '').slice(0, 180) || 'document'
  const attachment: Attachment = {
    id: params.id,
    name: nom,
    type: url.searchParams.get('type') ?? '',
    source,
    downloadType: url.searchParams.get('type') ?? '',
  }

  const { api } = clientFor(record, id)
  const result = await api.download(attachment)
  await persist(id, record)
  if (!result.ok) error(result.kind === 'access-denied' ? 403 : 502, result.message)

  const verification = verifierPieceJointe(url.searchParams.get('nom') ?? nom, result.value.bytes.byteLength)
  if (!verification.ok) {
    const typeRefuse = !verifierPieceJointe(url.searchParams.get('nom') ?? nom, 0).ok
    error(typeRefuse ? 415 : 413, verification.raison)
  }

  return new Response(result.value.bytes as BodyInit, {
    headers: {
      'Content-Type': result.value.contentType,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(nom)}`,
      'Cache-Control': 'private, no-store',
    },
  })
}
