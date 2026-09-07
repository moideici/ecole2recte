import type { Attachment, AttachmentSource } from '../models.js'
import { type Json, objects, pickText } from './json.js'

/**
 * Les pièces jointes, dont la forme est la même partout mais le nom de la liste jamais.
 *
 * Le `type` rendu par le service est ce qu'il faudra lui redonner au téléchargement : le
 * garder tel quel évite de le deviner plus tard.
 */
export function parseAttachments(value: unknown, source: AttachmentSource): Attachment[] {
  const found: Attachment[] = []
  for (const raw of objects(value)) {
    const id = pickText(raw, 'id', 'idDocument', 'fichierId')
    if (id === '') continue
    found.push({
      id,
      name: pickText(raw, 'libelle', 'nom', 'name') || 'Document',
      type: pickText(raw, 'type'),
      source,
      downloadType: pickText(raw, 'type'),
    })
  }
  return found
}

/** Les listes de pièces jointes portent quatre noms selon l'endpoint. */
export function attachmentsOf(source: Json, kind: AttachmentSource): Attachment[] {
  for (const key of ['documents', 'files', 'fichiers', 'piecesJointes']) {
    const parsed = parseAttachments(source[key], kind)
    if (parsed.length > 0) return parsed
  }
  return []
}
