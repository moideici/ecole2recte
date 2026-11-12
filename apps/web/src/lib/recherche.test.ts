import { describe, expect, it } from 'vitest'
import type { HomeworkItem, MessageItem, Grade } from '@ecole2recte/protocol'
import { rechercher } from './recherche.js'

const devoir: HomeworkItem = { id: 'd', subject: 'Français', content: 'École', dueDate: '2026-11-12', exam: false, done: false, attachments: [], onlineSubmission: false }
const message: MessageItem = { id: 'm', subject: 'Sortie', sender: 'École', read: false, preview: '', body: '', attachments: [], folder: 'received', recipients: [] }
const note: Grade = { id: 'n', subject: 'Français', label: 'École', scale: 20, coefficient: 1, periodCode: 'p', counted: true, comment: '', kind: '', skills: [] }
const sources = { devoirs: [devoir], messages: [message], notes: [note] }

describe('recherche globale', () => {
  it('ignore les accents et donne les liens par type', () => {
    expect(rechercher('ecole', sources)).toEqual([
      { type: 'devoir', titre: 'Français', detail: 'École', href: '/devoirs/2026-11-12' },
      { type: 'message', titre: 'Sortie', detail: 'École', href: '/messages/m' },
      { type: 'note', titre: 'Français', detail: 'École', href: '/notes' },
    ])
  })
  it.each(['', ' ', 'e', ' é '])('ignore la requête trop courte %s', (q) => expect(rechercher(q, sources)).toEqual([]))
  it('cherche aussi dans les matières et les objets', () => {
    expect(rechercher('francais', sources).map((resultat) => resultat.type)).toEqual(['devoir', 'note'])
    expect(rechercher('sortie', sources).map((resultat) => resultat.type)).toEqual(['message'])
  })
  it('limite le total à cinquante', () => {
    expect(rechercher('ecole', { ...sources, devoirs: Array.from({ length: 60 }, (_, i) => ({ ...devoir, id: String(i) })) })).toHaveLength(50)
  })
  it('limite aussi les résultats des messages et des notes', () => {
    expect(rechercher('ecole', { devoirs: [], messages: Array(60).fill(message), notes: [note] })).toHaveLength(50)
    expect(rechercher('ecole', { devoirs: [], messages: [], notes: Array(60).fill(note) })).toHaveLength(50)
  })
})
