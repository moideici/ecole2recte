import { base64DecodeOrRaw } from '../encoding.js'
import type { HomeworkItem, SessionContent } from '../models.js'
import { attachmentsOf } from './attachments.js'
import { type Json, asObject, isoDate, objects, pickBool, pickDate, pickText, plainText, text } from './json.js'

/**
 * Le cahier de textes, qui se lit en deux temps.
 *
 * Le résumé (`cahierdetexte.awp`) rend, pour chaque date, la liste des matières qui ont un
 * devoir — mais **sans son contenu**. Le contenu et les pièces jointes n'arrivent qu'avec le
 * détail d'un jour (`cahierdetexte/{date}.awp`). C'est voulu côté service : charger l'année
 * entière avec les énoncés serait énorme. L'application charge donc le résumé partout, et le
 * détail à l'ouverture d'une fiche.
 */
export function parseHomeworkSummary(data: unknown): HomeworkItem[] {
  const root = asObject(data)
  if (!root) return []
  const items: HomeworkItem[] = []
  for (const [key, value] of Object.entries(root)) {
    const dueDate = isoDate(key)
    if (!dueDate) continue
    for (const raw of objects(value)) {
      items.push(homeworkFrom(raw, dueDate, ''))
    }
  }
  return items.sort((left, right) => left.dueDate.localeCompare(right.dueDate))
}

function homeworkFrom(raw: Json, dueDate: string, content: string): HomeworkItem {
  const todo = asObject(raw['aFaire'])
  const source = todo ?? raw
  const body = content !== '' ? content : decodeContent(source)
  const item: HomeworkItem = {
    /*
     * `idDevoir` d'abord, où qu'il soit.
     *
     * Le résumé le porte à la racine, le détail d'un jour le porte dans `aFaire` — et la
     * racine y porte un identifiant de **séance**, différent. Lire la racine en premier
     * donnerait deux identifiants pour un même devoir, et le détail ne se raccrocherait
     * jamais à la ligne du résumé.
     */
    id:
      pickText(source, 'idDevoir') ||
      pickText(raw, 'idDevoir', 'id') ||
      `${dueDate}-${pickText(raw, 'matiere', 'codeMatiere')}`,
    subject: pickText(raw, 'matiere', 'libelleMatiere') || pickText(source, 'matiere'),
    dueDate,
    content: body,
    exam: pickBool(raw, ['interrogation', 'isInterrogation']),
    done: pickBool(source, ['effectue', 'isEffectue']),
    attachments: attachmentsOf(source, 'homework'),
    // Le devoir attend une copie déposée en ligne : cocher une case ne rend rien.
    onlineSubmission: pickBool(source, ['rendreEnLigne', 'aRendre', 'depotEnLigne']),
  }
  const givenOn = pickDate(source, 'donneLe') ?? pickDate(raw, 'donneLe')
  if (givenOn) item.givenOn = givenOn
  return item
}

function decodeContent(source: Json): string {
  const raw = text(source['contenu'] ?? source['content'])
  if (raw === '') return ''
  return plainText(base64DecodeOrRaw(raw))
}

export interface DayContent {
  homework: HomeworkItem[]
  sessions: SessionContent[]
}

/** Le détail d'un jour : les énoncés, et ce qui a été fait en cours. */
export function parseDayContent(data: unknown, date: string): DayContent {
  const root = asObject(data)
  const homework: HomeworkItem[] = []
  const sessions: SessionContent[] = []
  for (const raw of objects(root?.['matieres'])) {
    const subject = pickText(raw, 'matiere', 'libelleMatiere')
    if (asObject(raw['aFaire'])) homework.push(homeworkFrom(raw, date, ''))

    const lesson = asObject(raw['contenuDeSeance'])
    if (!lesson) continue
    const content = decodeContent(lesson)
    const attachments = attachmentsOf(lesson, 'homework')
    // Une séance sans contenu ni document n'apprend rien : ne pas l'afficher est plus honnête
    // qu'une carte vide.
    if (content === '' && attachments.length === 0) continue
    sessions.push({
      id: pickText(raw, 'id') || `${date}-${subject}`,
      subject,
      date,
      content,
      attachments,
    })
  }
  return { homework, sessions }
}
