import { describe, expect, it } from 'vitest'
import { parseGrades } from '../src/parse/grades.js'
import { parseTimetable } from '../src/parse/timetable.js'
import {
  currentLesson,
  dayProgress,
  gaps,
  generalAverage,
  matches,
  nextLesson,
  pendingHomework,
  requiredGrade,
  simulate,
  unreadMessages,
  weightedAverage,
} from '../src/insights.js'
import type { HomeworkItem, MessageItem } from '../src/models.js'
import * as fixtures from './fixtures.js'

const cours = parseTimetable(fixtures.TIMETABLE)
const { grades, periods } = parseGrades(fixtures.GRADES)

describe('journée', () => {
  it('ignore un cours annulé pour dire le suivant', () => {
    // Une salle vide n'est pas un cours : proposer un cours annulé serait un mensonge.
    expect(nextLesson(cours, '2026-09-07T10:30:00')?.id).toBeUndefined()
    expect(nextLesson(cours, '2026-09-07T09:30:00')?.id).toBe('102')
  })

  it('trouve le cours en cours', () => {
    expect(currentLesson(cours, '2026-09-07T08:30:00')?.subject).toBe('Mathématiques')
    expect(currentLesson(cours, '2026-09-07T09:30:00')).toBeUndefined()
  })

  it('mesure l’avancement du premier au dernier cours', () => {
    expect(dayProgress(cours, '2026-09-07T07:00:00')).toBe(0)
    expect(dayProgress(cours, '2026-09-07T23:00:00')).toBe(1)
    expect(dayProgress(cours, '2026-09-07T09:00:00')).toBeCloseTo(0.5, 2)
  })

  it('ne signale que les trous qui en sont', () => {
    // Une intercours de dix minutes n'est pas une permanence.
    expect(gaps(cours).map((trou) => trou.minutes)).toEqual([60])
  })
})

describe('moyennes', () => {
  it('ne compte ni les notes sans valeur ni celles hors moyenne', () => {
    // 15,5 coef 2 seule : « Abs » n'est pas un zéro, et le devoir maison ne compte pas.
    expect(weightedAverage(grades.filter((note) => note.counted && note.value !== undefined))).toBeCloseTo(15.5, 5)
  })

  it('préfère la moyenne de l’établissement à la sienne', () => {
    const officielle = generalAverage(periods[0]?.average, grades, 'A001')
    expect(officielle).toEqual({ value: 13.42, computed: false })
  })

  it('annonce clairement quand elle calcule', () => {
    const calculee = generalAverage(undefined, grades, 'A001')
    expect(calculee.computed).toBe(true)
    expect(calculee.value).toBeCloseTo(15.5, 5)
  })

  it('ramène sur 20 avant de comparer', () => {
    const surCinq = [
      { ...(grades[0] as (typeof grades)[number]), id: 'x', value: 5, scale: 5, coefficient: 1 },
    ]
    expect(weightedAverage(surCinq)).toBe(20)
  })
})

describe('simulateur', () => {
  it('dit ce que devient la moyenne', () => {
    const simulation = simulate(grades, 'A001', { value: 10, coefficient: 1 })
    expect(simulation.before).toBeCloseTo(15.5, 5)
    // (15,5 × 2 + 10 × 1) / 3
    expect(simulation.after).toBeCloseTo(13.6667, 3)
    expect(simulation.delta).toBeLessThan(0)
  })

  it('dit la note à viser', () => {
    const vise = requiredGrade(grades, 'A001', { target: 16, coefficient: 1 })
    // (16 × 3 − 31) / 1 = 17
    expect(vise?.value).toBeCloseTo(17, 5)
    expect(vise?.reachable).toBe(true)
  })

  it('avoue qu’un objectif est hors d’atteinte plutôt que de rendre 27/20', () => {
    const vise = requiredGrade(grades, 'A001', { target: 20, coefficient: 1 })
    expect(vise?.reachable).toBe(false)
  })
})

describe('listes', () => {
  const devoirs: HomeworkItem[] = [
    { id: '1', subject: 'A', dueDate: '2026-09-10', content: '', exam: false, done: false, attachments: [], onlineSubmission: false },
    { id: '2', subject: 'B', dueDate: '2026-09-01', content: '', exam: false, done: false, attachments: [], onlineSubmission: false },
    { id: '3', subject: 'C', dueDate: '2026-09-12', content: '', exam: false, done: true, attachments: [], onlineSubmission: false },
  ]

  it('ne garde à faire que ce qui est encore à faire', () => {
    expect(pendingHomework(devoirs, '2026-09-07').map((devoir) => devoir.id)).toEqual(['1'])
  })

  it('accepte qu’un état local prime, le temps que le serveur suive', () => {
    expect(pendingHomework(devoirs, '2026-09-07', { '1': true })).toHaveLength(0)
  })

  it('ne compte le non-lu que dans les reçus', () => {
    const messages: MessageItem[] = [
      { id: '1', subject: '', sender: '', read: false, preview: '', body: '', attachments: [], folder: 'received', recipients: [] },
      { id: '2', subject: '', sender: '', read: false, preview: '', body: '', attachments: [], folder: 'sent', recipients: [] },
    ]
    expect(unreadMessages(messages).map((message) => message.id)).toEqual(['1'])
  })
})

describe('recherche', () => {
  it('ignore accents et casse', () => {
    expect(matches('maths', 'Mathématiques')).toBe(true)
    expect(matches('MATHEMATIQUES', 'Mathématiques')).toBe(true)
    expect(matches('élève', 'Eleve studieux')).toBe(true)
  })

  it('exige tous les mots, dans n’importe quel ordre', () => {
    expect(matches('petit maths', 'Mathématiques', 'M. Petit')).toBe(true)
    expect(matches('petit anglais', 'Mathématiques', 'M. Petit')).toBe(false)
  })

  it('ne filtre rien sans question', () => {
    expect(matches('', 'quoi que ce soit')).toBe(true)
  })
})
