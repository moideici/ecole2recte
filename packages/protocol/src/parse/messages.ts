import { base64DecodeOrRaw } from '../encoding.js'
import type { MessageClassifier, MessageFolder, MessageItem } from '../models.js'
import { attachmentsOf } from './attachments.js'
import {
  type Json,
  asObject,
  objects,
  personName,
  pickBool,
  pickDateTime,
  pickText,
  plainText,
  text,
} from './json.js'

export interface MessagesPayload {
  messages: MessageItem[]
  classifiers: MessageClassifier[]
  /** Nombre total annoncé par le service, quand il le dit : sert à savoir s'il reste des pages. */
  total?: number
}

/**
 * La messagerie.
 *
 * Le service rend les trois dossiers dans un même objet, ce qui invite à tout charger d'un
 * coup ; l'application ne charge que celui qu'on regarde. Le corps arrive encodé en base64
 * et contient du HTML : l'aperçu de liste en est la version texte, jamais le balisage brut.
 */
export function parseMessages(data: unknown, folder: MessageFolder): MessagesPayload {
  const root = asObject(data)
  if (!root) return { messages: [], classifiers: [] }

  const classifiers: MessageClassifier[] = objects(root['classeurs'])
    .map((raw) => ({ id: pickText(raw, 'id'), label: pickText(raw, 'libelle', 'nom') }))
    .filter((entry) => entry.id !== '' && entry.label !== '')

  const container = asObject(root['messages'])
  // Le dossier demandé, sinon la liste à plat : la forme change selon l'endpoint.
  const list = container ? (container[folder] ?? container['received']) : root['messages']

  const messages = objects(list).map((raw) => messageFrom(raw, folder))
  const payload: MessagesPayload = { messages, classifiers }
  const pagination = asObject(root['pagination'])
  const total = Number(text(pagination?.['total'] ?? root['nbMessagesTotal'] ?? ''))
  if (Number.isFinite(total) && total > 0) payload.total = total
  return payload
}

function messageFrom(raw: Json, folder: MessageFolder): MessageItem {
  const body = decodeBody(raw)
  const recipients = objects(raw['to'])
    .map((entry) => personName(entry))
    .filter((name) => name !== '')
  const message: MessageItem = {
    id: pickText(raw, 'id'),
    subject: pickText(raw, 'subject', 'objet') || '(sans objet)',
    sender: personName(asObject(raw['from'])) || pickText(raw, 'expediteur'),
    // `read` vient du serveur ; l'état local n'en est qu'un miroir immédiat.
    read: pickBool(raw, ['read', 'lu']),
    preview: body === '' ? '' : firstLine(body),
    body,
    attachments: attachmentsOf(raw, 'message'),
    folder,
    recipients,
  }
  const date = pickDateTime(raw, 'date', 'dateEnvoi')
  if (date) message.date = date
  return message
}

function decodeBody(raw: Json): string {
  const encoded = text(raw['content'] ?? raw['contenu'])
  if (encoded === '') return ''
  return plainText(base64DecodeOrRaw(encoded))
}

function firstLine(body: string): string {
  const line = body.split('\n').find((entry) => entry.trim() !== '') ?? ''
  return line.length > 160 ? `${line.slice(0, 157)}…` : line
}

/** Le détail d'un message : le corps complet et ses pièces jointes. */
export function parseMessageDetail(data: unknown, folder: MessageFolder): MessageItem | null {
  const root = asObject(data)
  if (!root) return null
  const source = asObject(root['message']) ?? root
  if (pickText(source, 'id') === '') return null
  return messageFrom(source, folder)
}
