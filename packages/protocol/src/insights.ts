import { dateOf, minutesBetween } from './dates.js'
import type { Grade, HomeworkItem, Lesson, MessageItem, SchoolLifeEvent, SubjectAverage } from './models.js'
import { isSubSubject, outOfTwenty } from './models.js'

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

/**
 * L'écart en deçà duquel deux moyennes sont la même.
 *
 * Une moyenne publiée arrive arrondie — « 14,26 », parfois « 14,3 ». Comparer à l'unité près
 * ferait passer chaque arrondi pour un désaccord.
 */
const AVERAGE_TOLERANCE = 0.055

/**
 * D'où vient la moyenne affichée.
 *
 * - `official` : celle de l'établissement, et elle connaît les dernières notes.
 * - `recomputed` : celle de l'établissement a été calculée **avant** des notes déjà saisies ;
 *   on affiche la nôtre, à jour, et on dit lesquelles manquaient.
 * - `computed` : l'établissement n'en publie pas ; on calcule, et on le dit.
 * - `none` : rien de chiffré à afficher.
 */
export type AverageOrigin = 'official' | 'recomputed' | 'computed' | 'none'

export interface AverageVerdict {
  /** La moyenne à afficher, sur 20. */
  value: number | undefined
  /** Vrai quand la valeur affichée sort de notre calcul et non du bulletin. */
  computed: boolean
  origin: AverageOrigin
  /** Celle que l'établissement publie, quand il en publie une — gardée même écartée. */
  official: number | undefined
  /** Les notes que la moyenne publiée ne connaît pas encore, la plus récente en tête. */
  behind: Grade[]
}

function byDateDesc(left: Grade, right: Grade): number {
  return (right.date ?? '').localeCompare(left.date ?? '')
}

/**
 * Les notes arrivées après le calcul de la moyenne publiée.
 *
 * ÉcoleDirecte n'expose aucune date de calcul : la seule façon de savoir sans la deviner est
 * de retirer les notes une à une, de la plus récente à la plus ancienne, et de regarder si la
 * moyenne publiée réapparaît. Si oui, elle a été calculée avant celles qu'on vient d'ôter.
 *
 * Une note sans date arrête la recherche : on ne peut pas dire d'elle qu'elle est « après ».
 */
function gradesBehind(grades: Grade[], official: number): Grade[] {
  const ordered = [...grades].sort(byDateDesc)
  for (let dropped = 1; dropped < ordered.length; dropped += 1) {
    if (ordered[dropped - 1]?.date === undefined) break
    const partial = weightedAverage(ordered.slice(dropped))
    if (partial !== undefined && Math.abs(partial - official) <= AVERAGE_TOLERANCE) {
      return ordered.slice(0, dropped)
    }
  }
  return []
}

/**
 * La moyenne d'un lot de notes, confrontée à celle que l'établissement publie.
 *
 * La règle reste celle du bulletin : **l'établissement prime**, parce que tous les
 * coefficients ne sont pas exposés et que les règles de calcul lui appartiennent. Avec une
 * exception, et une seule : quand sa moyenne est manifestement celle d'**avant** des notes
 * déjà saisies, l'afficher revient à cacher la dernière note. On affiche alors la nôtre, et
 * on dit laquelle manquait.
 */
export function reconcileAverage(official: number | undefined, grades: Grade[]): AverageVerdict {
  const usable = grades.filter((grade) => grade.counted && outOfTwenty(grade) !== undefined)
  const computed = weightedAverage(usable)

  if (official === undefined) {
    return {
      value: computed,
      computed: computed !== undefined,
      origin: computed === undefined ? 'none' : 'computed',
      official,
      behind: [],
    }
  }
  if (computed === undefined || Math.abs(computed - official) <= AVERAGE_TOLERANCE) {
    return { value: official, computed: false, origin: 'official', official, behind: [] }
  }

  const behind = gradesBehind(usable, official)
  if (behind.length === 0) {
    // Un écart sans explication n'est pas un retard : coefficients cachés, règle maison,
    // matière regroupée. Dans le doute, le bulletin a raison.
    return { value: official, computed: false, origin: 'official', official, behind: [] }
  }
  return { value: computed, computed: true, origin: 'recomputed', official, behind }
}

export interface SubjectVerdict {
  average: SubjectAverage
  verdict: AverageVerdict
}

/** Le même arbitrage, matière par matière, sur une période. */
export function reconcileSubjectAverages(
  averages: SubjectAverage[],
  grades: Grade[],
  periodCode: string,
): SubjectVerdict[] {
  return averages
    .filter((entry) => entry.periodCode === periodCode)
    .map((entry) => ({
      average: entry,
      verdict: reconcileAverage(entry.average, gradesFor(grades, periodCode, entry.subject)),
    }))
}

/**
 * La moyenne générale à partir des moyennes de matières, pondérées par leur coefficient.
 *
 * C'est ainsi que le bulletin la fait, et c'est ce qui la distingue d'une moyenne à plat de
 * toutes les notes : celle-ci ferait peser une matière à six devoirs trois fois plus qu'une
 * matière à deux, quel que soit son coefficient.
 */
export function averageOfSubjects(subjects: SubjectVerdict[]): number | undefined {
  let total = 0
  let weight = 0
  for (const entry of subjects) {
    // Une sous-matière est déjà comptée dans sa mère : l'ajouter la compterait deux fois.
    if (isSubSubject(entry.average)) continue
    const value = entry.verdict.value
    if (value === undefined) continue
    const declared = entry.average.coefficient ?? 1
    const coefficient = declared > 0 ? declared : 1
    total += value * coefficient
    weight += coefficient
  }
  return weight === 0 ? undefined : total / weight
}

/**
 * La moyenne générale de la période.
 *
 * Sans moyennes de matières, on retombe sur la moyenne à plat des notes — c'est tout ce
 * qu'on peut faire. Et dès qu'**une** matière a été notée après le calcul du bulletin, la
 * moyenne générale qu'il publie est antérieure elle aussi : elle est recalculée.
 */
export function generalAverage(
  official: number | undefined,
  grades: Grade[],
  periodCode: string,
  averages: SubjectAverage[] = [],
): AverageVerdict {
  const subjects = reconcileSubjectAverages(averages, grades, periodCode)
  const behind = subjects.flatMap((entry) => entry.verdict.behind).sort(byDateDesc)
  const mine = averageOfSubjects(subjects) ?? weightedAverage(gradesFor(grades, periodCode))

  if (official === undefined) {
    return {
      value: mine,
      computed: mine !== undefined,
      origin: mine === undefined ? 'none' : 'computed',
      official,
      behind: [],
    }
  }
  if (behind.length === 0 || mine === undefined) {
    return { value: official, computed: false, origin: 'official', official, behind: [] }
  }
  return { value: mine, computed: true, origin: 'recomputed', official, behind }
}

/** La note qu'on n'a pas encore, telle qu'elle compterait si on l'avait. */
function hypotheticalGrade(
  periodCode: string,
  options: { subject?: string; value: number; scale?: number; coefficient?: number },
): Grade {
  return {
    id: '__simulation__',
    subject: options.subject ?? '',
    label: 'Simulation',
    value: options.value,
    scale: options.scale ?? 20,
    coefficient: options.coefficient ?? 1,
    periodCode,
    counted: true,
    comment: '',
    kind: '',
    skills: [],
  }
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
  const existing = gradesFor(grades, periodCode, options.subject)
  const before = weightedAverage(existing)
  const after = weightedAverage([...existing, hypotheticalGrade(periodCode, options)])
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

/**
 * Tous les mots doivent se retrouver, dans n'importe quel ordre.
 *
 * Le pluriel est toléré : « maths » doit trouver « Mathématiques », et personne ne tape le
 * singulier exact d'une matière. C'est la seule souplesse accordée — au-delà, un
 * dictionnaire de synonymes ferait trouver des choses qu'on n'a pas demandées.
 */
export function matches(query: string, ...fields: Array<string | undefined>): boolean {
  const needle = normalize(query)
  if (needle === '') return true
  const words = needle.split(/\s+/).filter((word) => word !== '')
  const haystack = fields.filter((field): field is string => typeof field === 'string').map(normalize).join(' ')
  return words.every((word) => {
    if (haystack.includes(word)) return true
    return word.endsWith('s') && word.length > 2 && haystack.includes(word.slice(0, -1))
  })
}
