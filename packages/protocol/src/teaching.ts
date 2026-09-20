import type { Attachment } from './models.js'

/**
 * L'espace professeur : le modèle et ses calculs.
 *
 * Tout ce qui suit est **en lecture**. Les formes sont celles que lisent les clients qui
 * tournent en réel sur l'hôte enseignant ; aucune n'a encore été confrontée à un compte
 * enseignant de ce projet. Les lecteurs sont donc tolérants, et tout ce qui est calculé ici
 * doit s'annoncer comme calculé : l'établissement applique ses propres règles.
 */

export type EntityKind = 'C' | 'G'

/** Une classe (`C`) ou un groupe (`G`) : l'unité à laquelle un professeur enseigne. */
export interface TeachingGroupRef {
  kind: EntityKind
  id: string
  code: string
  label: string
}

export interface TeacherSubject {
  code: string
  label: string
  /** Faux pour une matière sans notation : elle n'a pas de grille de notes. */
  graded: boolean
}

export interface TeacherPeriod {
  /** `A001`, `A002`… : c'est ce code qui entre dans les routes de notes. */
  code: string
  label: string
  shortLabel: string
  open: boolean
  start?: string
  end?: string
  councilDate?: string
  subjects: TeacherSubject[]
}

export interface TeachingGroup extends TeachingGroupRef {
  schoolId: string
  /** Le professeur connecté est professeur principal de cette classe. */
  headTeacher: boolean
  periods: TeacherPeriod[]
}

export interface TeacherCatalog {
  schools: Array<{ id: string; code: string; name: string }>
  groups: TeachingGroup[]
  /** Les créneaux de la grille d'appel, en `HH:MM`. */
  attendanceSlots: Array<{ start: string; end: string }>
}

/** Ce que le login dit d'un professeur, avant tout autre appel. */
export interface TeacherProfile {
  classes: TeachingGroupRef[]
  groups: TeachingGroupRef[]
  subjects: Array<{ code: string; label: string }>
  /** Enseignant et membre du personnel à la fois : le service sait basculer d'un rôle à l'autre. */
  dualRole: boolean
}

export interface Pupil {
  id: string
  firstName: string
  lastName: string
  /** `F`, `M`, ou vide quand le service ne le dit pas. */
  sex: string
  className: string
  birthDate?: string
  regime: string
  /** L'adresse de la photo telle que rendue. Son téléchargement n'est documenté nulle part. */
  photo: string
  /** Dispositifs d'accompagnement (ULIS, PAP…), par libellé. */
  supports: string[]
  dispensed: boolean
  leftOn?: string
}

export interface SlotContent {
  id: string
  /** Texte lisible : le service l'envoie en HTML, souvent encodé en base64. */
  content: string
  attachments: Attachment[]
}

export interface HomeworkContent extends SlotContent {
  givenOn?: string
  onlineSubmission: boolean
}

/** Une séance du cahier de textes, avec ce qui a été fait et ce qui est à faire. */
export interface LessonSlot {
  id: string
  date: string
  start: string
  end: string
  group: TeachingGroupRef
  room: string
  subjectCode: string
  subject: string
  exam: boolean
  homework?: HomeworkContent
  session?: SlotContent
}

export interface Assessment {
  id: string
  label: string
  date?: string
  coefficient: number
  scale: number
  /** Faux pour une évaluation non significative : aucune moyenne ne la compte. */
  counted: boolean
  graded: boolean
  kind: string
  author: string
  comment: string
  periodCode: string
}

export interface Mark {
  /** La note telle qu'écrite : « 12,5 », « Abs », « Disp »… Jamais réinterprétée. */
  raw: string
  value?: number
  comment: string
}

export interface GradebookRow {
  pupil: { id: string; firstName: string; lastName: string; className: string; sex: string }
  /** Par identifiant d'évaluation. */
  marks: Record<string, Mark>
}

export interface Gradebook {
  assessments: Assessment[]
  rows: GradebookRow[]
}

// ————————————————————————————————————————————————————————— calculs

/** L'année scolaire au sens d'ÉcoleDirecte (`2026-2027`) : elle bascule en août. */
export function schoolYear(today: string): string {
  const year = Number(today.slice(0, 4))
  const month = Number(today.slice(5, 7))
  const first = month >= 8 ? year : year - 1
  return `${first}-${first + 1}`
}

/** La clé d'une classe ou d'un groupe dans une adresse : `C-812`, `G-901`. */
export function groupKey(group: { kind: EntityKind; id: string }): string {
  return `${group.kind}-${group.id}`
}

export function parseGroupKey(key: string): { kind: EntityKind; id: string } | null {
  const match = /^([CG])-(\d+)$/.exec(key)
  return match ? { kind: match[1] as EntityKind, id: match[2] as string } : null
}

export interface AssessmentStats {
  count: number
  average?: number
  minimum?: number
  maximum?: number
}

/** Les chiffres d'une évaluation, sur son propre barème. Une absence n'est pas un zéro. */
export function assessmentStats(gradebook: Gradebook, assessmentId: string): AssessmentStats {
  const values = gradebook.rows
    .map((row) => row.marks[assessmentId]?.value)
    .filter((value): value is number => value !== undefined)
  if (values.length === 0) return { count: 0 }
  return {
    count: values.length,
    average: values.reduce((total, value) => total + value, 0) / values.length,
    minimum: Math.min(...values),
    maximum: Math.max(...values),
  }
}

/**
 * La moyenne d'un élève sur 20, **calculée** à partir de la grille : barèmes ramenés sur 20,
 * coefficients appliqués, évaluations non significatives écartées.
 *
 * Elle peut différer de celle du bulletin, qui suit les règles de l'établissement (arrondis,
 * sous-matières, notes hors grille) : l'interface doit la présenter comme une estimation.
 */
export function pupilAverage(gradebook: Gradebook, pupilId: string): number | undefined {
  const row = gradebook.rows.find((entry) => entry.pupil.id === pupilId)
  if (!row) return undefined
  let total = 0
  let weight = 0
  for (const assessment of gradebook.assessments) {
    if (!assessment.counted || assessment.scale <= 0 || assessment.coefficient <= 0) continue
    const value = row.marks[assessment.id]?.value
    if (value === undefined) continue
    total += ((value * 20) / assessment.scale) * assessment.coefficient
    weight += assessment.coefficient
  }
  return weight === 0 ? undefined : total / weight
}

/** La moyenne des moyennes calculées : même réserve que `pupilAverage`. */
export function groupAverage(gradebook: Gradebook): number | undefined {
  const averages = gradebook.rows
    .map((row) => pupilAverage(gradebook, row.pupil.id))
    .filter((value): value is number => value !== undefined)
  return averages.length === 0 ? undefined : averages.reduce((total, value) => total + value, 0) / averages.length
}
