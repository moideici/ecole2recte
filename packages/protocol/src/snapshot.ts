import type { ApiFailure } from './codes.js'
import type { EcoleDirecteApi } from './api.js'
import { addDays, startOfWeek } from './dates.js'
import type {
  Account,
  CloudFile,
  Document,
  Grade,
  HomeworkItem,
  Lesson,
  MessageClassifier,
  MessageItem,
  NewsItem,
  Period,
  SchoolLifeEvent,
  SessionContent,
  SubjectAverage,
  Textbook,
} from './models.js'

export type DataSection =
  | 'timetable'
  | 'homework'
  | 'grades'
  | 'schoolLife'
  | 'messages'
  | 'documents'
  | 'news'
  | 'textbooks'
  | 'cloud'

/**
 * Les sections qu'un établissement peut ne pas ouvrir.
 *
 * Un refus sur l'une d'elles n'est pas une panne : c'est un module fermé. Le dire une fois,
 * à l'ouverture de son écran, vaut mieux qu'une erreur répétée à chaque synchronisation.
 */
export const OPTIONAL_SECTIONS: DataSection[] = ['news', 'textbooks', 'cloud']

export const ESSENTIAL_SECTIONS: DataSection[] = [
  'timetable',
  'homework',
  'grades',
  'schoolLife',
  'messages',
  'documents',
]

export const ALL_SECTIONS: DataSection[] = [...ESSENTIAL_SECTIONS, ...OPTIONAL_SECTIONS]

export const SECTION_LABELS: Record<DataSection, string> = {
  timetable: 'Emploi du temps',
  homework: 'Devoirs',
  grades: 'Notes',
  schoolLife: 'Vie scolaire',
  messages: 'Messages',
  documents: 'Documents',
  news: 'Actualités',
  textbooks: 'Manuels numériques',
  cloud: 'Espace de stockage',
}

/** Le module ÉcoleDirecte correspondant, quand il en existe un à interroger. */
export const SECTION_MODULES: Partial<Record<DataSection, string>> = {
  timetable: 'EDT',
  homework: 'CAHIER_DE_TEXTES',
  grades: 'NOTES',
  schoolLife: 'VIE_SCOLAIRE',
  messages: 'MESSAGERIE',
  documents: 'DOCUMENTS_ELEVE',
  cloud: 'CLOUD',
}

export interface SchoolSnapshot {
  account: Account | null
  lessons: Lesson[]
  homework: HomeworkItem[]
  sessionContents: SessionContent[]
  grades: Grade[]
  periods: Period[]
  subjectAverages: SubjectAverage[]
  schoolLife: SchoolLifeEvent[]
  messages: MessageItem[]
  classifiers: MessageClassifier[]
  documents: Document[]
  news: NewsItem[]
  textbooks: Textbook[]
  cloudFiles: CloudFile[]
  /** Horodatage par section : c'est lui qui dit ce qui a vieilli, et non un drapeau global. */
  syncedAt: Partial<Record<DataSection, number>>
}

export function emptySnapshot(account: Account | null = null): SchoolSnapshot {
  return {
    account,
    lessons: [],
    homework: [],
    sessionContents: [],
    grades: [],
    periods: [],
    subjectAverages: [],
    schoolLife: [],
    messages: [],
    classifiers: [],
    documents: [],
    news: [],
    textbooks: [],
    cloudFiles: [],
    syncedAt: {},
  }
}

export function lastSyncedAt(snapshot: SchoolSnapshot): number | undefined {
  const stamps = Object.values(snapshot.syncedAt).filter((value): value is number => typeof value === 'number')
  return stamps.length === 0 ? undefined : Math.max(...stamps)
}

export interface SyncOutcome {
  snapshot: SchoolSnapshot
  errors: Partial<Record<DataSection, ApiFailure>>
}

export interface SyncOptions {
  /** Date du jour, ISO. Injectée plutôt que lue : c'est ce qui rend le résultat vérifiable. */
  today: string
  sections?: DataSection[]
  /** Semaines d'emploi du temps chargées avant et après la semaine courante. */
  weeksBefore?: number
  weeksAfter?: number
}

/**
 * Charge les sections demandées, chacune indépendamment.
 *
 * Une section qui échoue n'emporte pas les autres : un module fermé, un serveur qui répond
 * mal sur les notes, et l'emploi du temps reste consultable. L'échec est rendu à part, par
 * section, pour être affiché **là où il s'est produit** plutôt qu'en bandeau global.
 */
export async function syncSections(
  api: EcoleDirecteApi,
  account: Account,
  options: SyncOptions,
): Promise<SyncOutcome> {
  const snapshot = emptySnapshot(account)
  const errors: Partial<Record<DataSection, ApiFailure>> = {}
  const sections = options.sections ?? ALL_SECTIONS
  const stamp = Date.now()

  const from = addDays(startOfWeek(options.today), -7 * (options.weeksBefore ?? 1))
  const to = addDays(startOfWeek(options.today), 7 * ((options.weeksAfter ?? 3) + 1) - 1)

  const jobs: Array<Promise<void>> = []

  const run = (section: DataSection, task: () => Promise<void>) => {
    if (!sections.includes(section)) return
    jobs.push(
      task().catch((error: unknown) => {
        // Une exception inattendue reste une erreur de section, pas un écran blanc.
        errors[section] = {
          ok: false,
          kind: 'protocol',
          message: 'Section illisible.',
          diagnostic: error instanceof Error ? error.name : 'inconnue',
        }
      }),
    )
  }

  const keep = <T>(section: DataSection, result: { ok: true; value: T } | ApiFailure, apply: (value: T) => void) => {
    if (result.ok) {
      apply(result.value)
      snapshot.syncedAt[section] = stamp
    } else {
      errors[section] = result
    }
  }

  run('timetable', async () => keep('timetable', await api.timetable(account, from, to), (value) => (snapshot.lessons = value)))
  run('homework', async () => keep('homework', await api.homework(account), (value) => (snapshot.homework = value)))
  run('grades', async () =>
    keep('grades', await api.grades(account), (value) => {
      snapshot.grades = value.grades
      snapshot.periods = value.periods
      snapshot.subjectAverages = value.subjectAverages
    }),
  )
  run('schoolLife', async () => keep('schoolLife', await api.schoolLife(account), (value) => (snapshot.schoolLife = value)))
  run('messages', async () =>
    keep('messages', await api.messages(account, { folder: 'received' }), (value) => {
      snapshot.messages = value.messages
      snapshot.classifiers = value.classifiers
    }),
  )
  run('documents', async () => keep('documents', await api.documents(account), (value) => (snapshot.documents = value)))
  run('news', async () => keep('news', await api.news(account), (value) => (snapshot.news = value)))
  run('textbooks', async () => keep('textbooks', await api.textbooks(account), (value) => (snapshot.textbooks = value)))
  run('cloud', async () => keep('cloud', await api.cloud(account), (value) => (snapshot.cloudFiles = value)))

  await Promise.all(jobs)
  return { snapshot, errors }
}

/** Fusionne un chargement partiel dans un instantané existant, sans effacer le reste. */
export function mergeSnapshot(base: SchoolSnapshot, incoming: SyncOutcome): SchoolSnapshot {
  const merged: SchoolSnapshot = { ...base, account: incoming.snapshot.account ?? base.account }
  const done = Object.keys(incoming.snapshot.syncedAt) as DataSection[]
  for (const section of done) {
    switch (section) {
      case 'timetable':
        merged.lessons = incoming.snapshot.lessons
        break
      case 'homework':
        merged.homework = incoming.snapshot.homework
        break
      case 'grades':
        merged.grades = incoming.snapshot.grades
        merged.periods = incoming.snapshot.periods
        merged.subjectAverages = incoming.snapshot.subjectAverages
        break
      case 'schoolLife':
        merged.schoolLife = incoming.snapshot.schoolLife
        break
      case 'messages':
        merged.messages = incoming.snapshot.messages
        merged.classifiers = incoming.snapshot.classifiers
        break
      case 'documents':
        merged.documents = incoming.snapshot.documents
        break
      case 'news':
        merged.news = incoming.snapshot.news
        break
      case 'textbooks':
        merged.textbooks = incoming.snapshot.textbooks
        break
      case 'cloud':
        merged.cloudFiles = incoming.snapshot.cloudFiles
        break
    }
  }
  merged.syncedAt = { ...base.syncedAt, ...incoming.snapshot.syncedAt }
  return merged
}
