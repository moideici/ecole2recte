import { dateOf, minutesBetween } from './dates.js'
import type { Grade, HomeworkItem, Lesson, MessageItem, SchoolLifeEvent, SubjectAverage } from './models.js'
import { outOfTwenty } from './models.js'

/**
 * Ce que les données veulent dire.
 *
 * Rien ici n'appelle le réseau : ce sont des lectures d'un instantané déjà chargé. C'est
 * aussi ici que se joue l'honnêteté de l'application — une moyenne qui compte une note non
 * significative, ou un compte à rebours qui ignore un cours annulé, ment poliment.
 */

export function lessonsOn(lessons: Lesson[], date: string): Lesson[] {
  return lessons.filter((lesson) => dateOf(lesson.start) === date)
}

/** Le prochain cours, en sautant ce qui est annulé : une salle vide n'est pas un cours. */
export function nextLesson(lessons: Lesson[], now: string): Lesson | undefined {
  return lessons
    .filter((lesson) => !lesson.canceled && lesson.start > now)
    .sort((left, right) => left.start.localeCompare(right.start))[0]
}

export function currentLesson(lessons: Lesson[], now: string): Lesson | undefined {
  return lessons.find((lesson) => !lesson.canceled && lesson.start <= now && lesson.end > now)
}

/** L'avancement de la journée, entre 0 et 1, du premier au dernier cours. */
export function dayProgress(lessons: Lesson[], now: string): number | undefined {
  const active = lessons.filter((lesson) => !lesson.canceled)
  if (active.length === 0) return undefined
  const first = active.reduce((left, right) => (left.start < right.start ? left : right)).start
  const last = active.reduce((left, right) => (left.end > right.end ? left : right)).end
  if (now <= first) return 0
  if (now >= last) return 1
  const total = minutesBetween(first, last)
  return total === 0 ? 1 : minutesBetween(first, now) / total
}

/** Les trous de plus de trente minutes : en deçà, c'est une intercours, pas une permanence. */
export function gaps(lessons: Lesson[]): Array<{ start: string; end: string; minutes: number }> {
  const active = lessons.filter((lesson) => !lesson.canceled).sort((left, right) => left.start.localeCompare(right.start))
  const found: Array<{ start: string; end: string; minutes: number }> = []
  for (let index = 1; index < active.length; index += 1) {
    const previous = active[index - 1] as Lesson
    const current = active[index] as Lesson
    const minutes = minutesBetween(previous.end, current.start)
    if (minutes > 30) found.push({ start: previous.end, end: current.start, minutes })
  }
  return found
}

export function isHomeworkDone(item: HomeworkItem, overrides: Record<string, boolean> = {}): boolean {
  return overrides[item.id] ?? item.done
}

export function pendingHomework(
  homework: HomeworkItem[],
  today: string,
  overrides: Record<string, boolean> = {},
): HomeworkItem[] {
  return homework
    .filter((item) => !isHomeworkDone(item, overrides) && item.dueDate >= today)
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
}

export function upcomingExams(homework: HomeworkItem[], today: string): HomeworkItem[] {
  return homework.filter((item) => item.exam && item.dueDate >= today).sort((left, right) => left.dueDate.localeCompare(right.dueDate))
}

export function unreadMessages(messages: MessageItem[], overrides: Record<string, boolean> = {}): MessageItem[] {
  return messages.filter((message) => message.folder === 'received' && !(overrides[message.id] ?? message.read))
}

export function unjustifiedAbsences(events: SchoolLifeEvent[]): SchoolLifeEvent[] {
  return events.filter((event) => event.kind === 'absence' && !event.justified)
}

// ————————————————————————————————————————————————————————— moyennes

export function gradesFor(grades: Grade[], periodCode: string, subject?: string): Grade[] {
  return grades.filter(
    (grade) =>
      grade.periodCode === periodCode &&
      grade.counted &&
      grade.value !== undefined &&
      (subject === undefined || grade.subject === subject),
  )
}

/**
 * La moyenne pondérée, sur 20.
 *
 * Ne compte que les notes significatives et chiffrées : une note « Abs » n'est pas un zéro,
 * et une note hors moyenne ne compte pas. C'est une moyenne **calculée** — celle que rend
 * l'établissement lui prime toujours, parce que tous les coefficients ne sont pas exposés.
 */
export function weightedAverage(grades: Grade[]): number | undefined {
  let total = 0
  let weight = 0
  for (const grade of grades) {
    const value = outOfTwenty(grade)
    if (value === undefined) continue
    const coefficient = grade.coefficient > 0 ? grade.coefficient : 1
    total += value * coefficient
    weight += coefficient
  }
  return weight === 0 ? undefined : total / weight
}

/** La moyenne officielle si elle existe, la moyenne calculée sinon — et il faut le dire. */
export function generalAverage(
  official: number | undefined,
  grades: Grade[],
  periodCode: string,
): { value: number | undefined; computed: boolean } {
  if (official !== undefined) return { value: official, computed: false }
  return { value: weightedAverage(gradesFor(grades, periodCode)), computed: true }
}

export interface Simulation {
  before: number | undefined
  after: number | undefined
  delta: number | undefined
}

/** « Si je prends 14 au prochain devoir, ça donne quoi ? » */
export function simulate(
  grades: Grade[],
  periodCode: string,
  options: { subject?: string; value: number; scale?: number; coefficient?: number },
): Simulation {
  const scale = options.scale ?? 20
  const existing = gradesFor(grades, periodCode, options.subject)
  const before = weightedAverage(existing)
  const hypothetical: Grade = {
    id: '__simulation__',
    subject: options.subject ?? '',
    label: 'Simulation',
    value: options.value,
    scale,
    coefficient: options.coefficient ?? 1,
    periodCode,
    counted: true,
    comment: '',
    kind: '',
    skills: [],
  }
  const after = weightedAverage([...existing, hypothetical])
  return {
    before,
    after,
    delta: before !== undefined && after !== undefined ? after - before : undefined,
  }
}

/**
 * La note à viser pour atteindre un objectif — ou l'aveu qu'il est hors d'atteinte.
 *
 * Rendre 27/20 serait une réponse mathématiquement juste et pratiquement inutile.
 */
export function requiredGrade(
  grades: Grade[],
  periodCode: string,
  options: { subject?: string; target: number; scale?: number; coefficient?: number },
): { value: number; reachable: boolean } | undefined {
  const scale = options.scale ?? 20
  const coefficient = options.coefficient ?? 1
  const existing = gradesFor(grades, periodCode, options.subject)
  let total = 0
  let weight = 0
  for (const grade of existing) {
    const value = outOfTwenty(grade)
    if (value === undefined) continue
    const own = grade.coefficient > 0 ? grade.coefficient : 1
    total += value * own
    weight += own
  }
  if (coefficient <= 0) return undefined
  const neededOutOfTwenty = (options.target * (weight + coefficient) - total) / coefficient
  const value = (neededOutOfTwenty * scale) / 20
  return { value, reachable: value >= 0 && value <= scale }
}

export function averageForSubject(averages: SubjectAverage[], periodCode: string, subject: string): SubjectAverage | undefined {
  return averages.find((entry) => entry.periodCode === periodCode && entry.subject === subject)
}

// ————————————————————————————————————————————————————————— recherche

/** Insensible aux accents et à la casse : « maths » doit trouver « Mathématiques ». */
export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function matches(query: string, ...fields: Array<string | undefined>): boolean {
  const needle = normalize(query)
  if (needle === '') return true
  const words = needle.split(/\s+/)
  const haystack = fields.filter((field): field is string => typeof field === 'string').map(normalize).join(' ')
  return words.every((word) => haystack.includes(word))
}
