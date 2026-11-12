import { matches, normalize, type HomeworkItem, type MessageItem, type Grade } from '@ecole2recte/protocol'

export type ResultatRecherche = { type: 'devoir' | 'message' | 'note'; titre: string; detail: string; href: string }

export function rechercher(q: string, sources: { devoirs: HomeworkItem[]; messages: MessageItem[]; notes: Grade[] }): ResultatRecherche[] {
  if (normalize(q).length < 2) return []
  const resultats: ResultatRecherche[] = []
  for (const item of sources.devoirs) {
    if (matches(q, item.subject, item.content)) resultats.push({ type: 'devoir', titre: item.subject, detail: item.content, href: `/devoirs/${item.dueDate}` })
    if (resultats.length === 50) return resultats
  }
  for (const item of sources.messages) {
    if (matches(q, item.sender, item.subject)) resultats.push({ type: 'message', titre: item.subject, detail: item.sender, href: `/messages/${item.id}` })
    if (resultats.length === 50) return resultats
  }
  for (const item of sources.notes) {
    if (matches(q, item.subject, item.label)) resultats.push({ type: 'note', titre: item.subject, detail: item.label, href: '/notes' })
    if (resultats.length === 50) return resultats
  }
  return resultats
}
