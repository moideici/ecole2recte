import { describe, expect, it } from 'vitest'
import { parseGrades } from '../src/parse/grades.js'
import { parseTimetable } from '../src/parse/timetable.js'
import {
  averageOfSubjects,
  currentLesson,
  dayProgress,
  gaps,
  generalAverage,
  matches,
  nextLesson,
  pendingHomework,
  reconcileAverage,
  reconcileSubjectAverages,
  requiredGrade,
  simulate,
  unreadMessages,
  weightedAverage,
} from '../src/insights.js'
import type { Grade, HomeworkItem, MessageItem, SubjectAverage } from '../src/models.js'
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
    expect(officielle.value).toBe(13.42)
    expect(officielle.computed).toBe(false)
    expect(officielle.origin).toBe('official')
  })

  it('annonce clairement quand elle calcule', () => {
    const calculee = generalAverage(undefined, grades, 'A001')
    expect(calculee.computed).toBe(true)
    expect(calculee.origin).toBe('computed')
    expect(calculee.value).toBeCloseTo(15.5, 5)
  })

  it('ramène sur 20 avant de comparer', () => {
    const surCinq = [
      { ...(grades[0] as (typeof grades)[number]), id: 'x', value: 5, scale: 5, coefficient: 1 },
    ]
    expect(weightedAverage(surCinq)).toBe(20)
  })
})

describe('moyenne publiée en retard', () => {
  function note(
    id: string,
    value: number,
    date: string | undefined,
    options: { subject?: string; coefficient?: number } = {},
  ): Grade {
    const grade: Grade = {
      id,
      subject: options.subject ?? 'Mathématiques',
      label: `Devoir ${id}`,
      value,
      scale: 20,
      coefficient: options.coefficient ?? 1,
      periodCode: 'A001',
      counted: true,
      comment: '',
      kind: '',
      skills: [],
    }
    if (date !== undefined) grade.date = date
    return grade
  }

  function matiere(subject: string, average: number | undefined, coefficient: number): SubjectAverage {
    const entry: SubjectAverage = {
      periodCode: 'A001',
      subject,
      teacher: '',
      teachers: [],
      appreciation: '',
      parentSubject: '',
      coefficient,
    }
    if (average !== undefined) entry.average = average
    return entry
  }

  const avant = note('1', 12, '2026-09-01')
  const derniere = note('2', 16, '2026-09-15')

  it('garde celle de l’établissement quand elle connaît la dernière note', () => {
    const verdict = reconcileAverage(14, [avant, derniere])
    expect(verdict.origin).toBe('official')
    expect(verdict.value).toBe(14)
    expect(verdict.behind).toEqual([])
  })

  it('tolère l’arrondi du bulletin, qui n’est pas un désaccord', () => {
    // 14,00 publié « 14,0 » : à 0,05 près, c'est la même moyenne.
    expect(reconcileAverage(14.04, [avant, derniere]).origin).toBe('official')
  })

  it('calcule la sienne quand la publiée est celle d’avant la dernière note', () => {
    const verdict = reconcileAverage(12, [avant, derniere])
    expect(verdict.origin).toBe('recomputed')
    expect(verdict.value).toBeCloseTo(14, 5)
    expect(verdict.official).toBe(12)
    expect(verdict.behind.map((grade) => grade.id)).toEqual(['2'])
  })

  it('remonte jusqu’à la dernière moyenne qui colle, fût-ce deux notes en arrière', () => {
    const encoreAvant = note('0', 10, '2026-08-25')
    // 10 seule : la publiée ignore les deux notes suivantes.
    const verdict = reconcileAverage(10, [encoreAvant, avant, derniere])
    expect(verdict.origin).toBe('recomputed')
    expect(verdict.behind.map((grade) => grade.id)).toEqual(['2', '1'])
  })

  it('laisse le bulletin avoir raison sur un écart inexpliqué', () => {
    // Aucun retrait ne retombe sur 5 : coefficient caché, règle maison. Dans le doute, lui.
    const verdict = reconcileAverage(5, [avant, derniere])
    expect(verdict.origin).toBe('official')
    expect(verdict.value).toBe(5)
  })

  it('ne dit « après » d’aucune note sans date', () => {
    const verdict = reconcileAverage(12, [note('1', 12, undefined), note('2', 16, undefined)])
    expect(verdict.origin).toBe('official')
  })

  it('calcule et le dit quand l’établissement ne publie rien', () => {
    const verdict = reconcileAverage(undefined, [avant, derniere])
    expect(verdict.origin).toBe('computed')
    expect(verdict.computed).toBe(true)
    expect(verdict.value).toBeCloseTo(14, 5)
  })

  it('recalcule la générale dès qu’une matière est en retard', () => {
    const notes = [avant, derniere, note('3', 8, '2026-09-10', { subject: 'Anglais' })]
    const matieres = [matiere('Mathématiques', 12, 4), matiere('Anglais', 8, 2)]
    const verdict = generalAverage(10.67, notes, 'A001', matieres)
    expect(verdict.origin).toBe('recomputed')
    // (14 × 4 + 8 × 2) / 6 : une moyenne de moyennes, pondérée par les coefficients.
    expect(verdict.value).toBeCloseTo(12, 5)
    expect(verdict.behind.map((grade) => grade.id)).toEqual(['2'])
  })

  it('garde la générale du bulletin tant qu’aucune matière n’est en retard', () => {
    const matieres = [matiere('Mathématiques', 14, 4)]
    const verdict = generalAverage(13.42, [avant, derniere], 'A001', matieres)
    expect(verdict.origin).toBe('official')
    expect(verdict.value).toBe(13.42)
  })

  it('ne compte pas deux fois une spécialité rangée sous son tronc commun', () => {
    const sous: SubjectAverage = { ...matiere('Spé maths', 18, 2), parentSubject: 'Mathématiques' }
    const subjects = reconcileSubjectAverages([matiere('Mathématiques', 10, 2), sous], [], 'A001')
    expect(averageOfSubjects(subjects)).toBeCloseTo(10, 5)
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
