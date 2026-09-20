import { base64DecodeOrRaw } from '../encoding.js'
import { normalize } from '../insights.js'
import type { Attachment } from '../models.js'
import type {
  Assessment,
  EntityKind,
  Gradebook,
  GradebookRow,
  HomeworkContent,
  LessonSlot,
  Mark,
  Pupil,
  SlotContent,
  TeacherCatalog,
  TeacherPeriod,
  TeacherProfile,
  TeachingGroup,
  TeachingGroupRef,
} from '../teaching.js'
import { groupKey } from '../teaching.js'
import { parseAttachments } from './attachments.js'
import {
  type Json,
  asObject,
  number,
  objects,
  pickBool,
  pickDate,
  pickDateTime,
  pickNumber,
  pickText,
  plainText,
  text,
} from './json.js'

/**
 * Les lecteurs de l'hôte enseignant.
 *
 * Mêmes principes que le reste de `parse/` : aucun ne lève, une clé absente ne vide pas
 * l'écran, et chaque variante connue d'un champ est acceptée. Les formes viennent des clients
 * qui lisent ces routes en réel ; elles n'ont pas encore été vérifiées sur un compte
 * enseignant de ce projet.
 */

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/

/** Le caractère que laisse un décodage UTF-8 raté. */
const REPLACEMENT = String.fromCharCode(0xfffd)

/**
 * Un contenu tantôt en base64, tantôt en clair.
 *
 * Décoder à l'aveugle transformerait une phrase en charabia : on ne décode que ce qui a la
 * forme du base64 **et** donne un texte valide une fois décodé.
 */
function readableContent(value: unknown): string {
  const raw = text(value).trim()
  if (raw === '') return ''
  const compact = raw.replace(/\s+/g, '')
  if (compact.length % 4 === 0 && BASE64.test(compact)) {
    const decoded = base64DecodeOrRaw(compact)
    if (!decoded.includes(REPLACEMENT)) return plainText(decoded)
  }
  return plainText(raw)
}

function kindOf(value: unknown, fallback: EntityKind): EntityKind {
  const kind = text(value).trim().toUpperCase()
  return kind === 'C' || kind === 'G' ? kind : fallback
}

/** Un identifiant utilisable : le service rend parfois `0` là où il n'en a pas. */
function usableId(...values: unknown[]): string {
  for (const value of values) {
    const id = text(value).trim()
    if (id !== '' && id !== '0') return id
  }
  return ''
}

// ————————————————————————————————————————————————————————— login

function groupRef(kind: EntityKind) {
  return (raw: Json): TeachingGroupRef => ({
    kind,
    id: usableId(raw['id'], raw['idGroupe']),
    code: pickText(raw, 'code'),
    label: pickText(raw, 'libelle', 'code'),
  })
}

/** Les classes, groupes et matières qu'un compte enseignant déclare au login. */
export function parseTeacherProfile(account: Json): TeacherProfile {
  const profile = asObject(account['profile'])
  return {
    classes: objects(profile?.['classes']).map(groupRef('C')).filter((entry) => entry.id !== ''),
    // Le login les appelle `groupesNiveau`, et non `groupes`.
    groups: objects(profile?.['groupesNiveau'] ?? profile?.['groupes'])
      .map(groupRef('G'))
      .filter((entry) => entry.id !== ''),
    subjects: objects(profile?.['matieres'])
      .map((raw) => ({ code: pickText(raw, 'code'), label: pickText(raw, 'libelle', 'code') }))
      .filter((entry) => entry.code !== ''),
    dualRole: pickBool(account, ['isProfEtPersonnel']),
  }
}

// ————————————————————————————————————————————————————————— catalogue

function periodFrom(raw: Json): TeacherPeriod | null {
  const code = pickText(raw, 'codePeriode', 'code')
  if (code === '') return null
  const state = pickText(raw, 'etat').trim().toLowerCase()
  const period: TeacherPeriod = {
    code,
    label: pickText(raw, 'libelle') || code,
    shortLabel: pickText(raw, 'libelleCourt'),
    // Seul « ouvert » est observé ; un état inconnu ne doit pas faire croire à une clôture.
    open: state === '' || state.startsWith('ouvert'),
    subjects: objects(raw['matieres'])
      .map((subject) => ({
        code: pickText(subject, 'code'),
        label: pickText(subject, 'libelle', 'libelleCourt', 'code'),
        graded: pickBool(subject, ['avecNotation'], true),
      }))
      .filter((subject) => subject.code !== ''),
  }
  const start = pickDate(raw, 'dateDebut')
  const end = pickDate(raw, 'dateFin')
  const council = pickDate(raw, 'dateConseil')
  if (start) period.start = start
  if (end) period.end = end
  if (council) period.councilDate = council
  return period
}

/** Une période peut apparaître deux fois : on garde la première, et sa liste de matières non vide. */
function mergePeriods(periods: TeacherPeriod[]): TeacherPeriod[] {
  const byCode = new Map<string, TeacherPeriod>()
  for (const period of periods) {
    const known = byCode.get(period.code)
    if (!known) byCode.set(period.code, period)
    else if (known.subjects.length === 0) known.subjects = period.subjects
  }
  return [...byCode.values()]
}

function groupFrom(
  raw: Json,
  fallbackKind: EntityKind,
  schoolId: string,
  teacher: { id: string; profile?: TeacherProfile | undefined },
): TeachingGroup | null {
  const kind = kindOf(raw['typeEntity'], fallbackKind)
  const code = pickText(raw, 'code')
  const label = pickText(raw, 'libelle', 'code')
  let id = usableId(raw['idGroupe'], raw['id'])

  // Une classe rendue sans identifiant se retrouve dans le profil du login, par code puis
  // par libellé débarrassé de ses accents.
  if (id === '' && teacher.profile) {
    const known = [...teacher.profile.classes, ...teacher.profile.groups].filter((entry) => entry.kind === kind)
    const match =
      known.find((entry) => code !== '' && entry.code === code) ??
      known.find((entry) => label !== '' && normalize(entry.label) === normalize(label))
    id = match?.id ?? ''
  }
  if (id === '') return null

  // Le tableau des professeurs principaux fait foi quand il nomme le compte ; sinon le drapeau.
  const headTeachers = objects(raw['tabPP']).map((entry) => pickText(entry, 'idPP', 'id'))
  const headTeacher = (teacher.id !== '' && headTeachers.includes(teacher.id)) || pickBool(raw, ['isPP'])

  return {
    kind,
    id,
    code,
    label: label || code,
    schoolId,
    headTeacher,
    periods: mergePeriods(objects(raw['periodes']).map(periodFrom).filter((entry): entry is TeacherPeriod => entry !== null)),
  }
}

/**
 * Le catalogue `niveauxListe.awp` : établissements, classes, groupes, périodes et matières.
 *
 * C'est la carte de tout le reste — une grille de notes se demande par classe, période et
 * matière, et ces trois codes ne se trouvent qu'ici. Deux formes existent : un tableau
 * d'établissements, ou un objet qui les range à côté des groupes rattachés.
 */
export function parseCatalog(
  data: unknown,
  teacher: { id: string; profile?: TeacherProfile | undefined } = { id: '' },
): TeacherCatalog {
  const root = asObject(data)
  const catalog: TeacherCatalog = { schools: [], groups: [], attendanceSlots: [] }
  const seenGroups = new Map<string, TeachingGroup>()
  const seenSlots = new Set<string>()

  const add = (group: TeachingGroup | null) => {
    if (!group) return
    const known = seenGroups.get(groupKey(group))
    if (known) {
      known.periods = mergePeriods([...known.periods, ...group.periods])
      known.headTeacher = known.headTeacher || group.headTeacher
      return
    }
    seenGroups.set(groupKey(group), group)
    catalog.groups.push(group)
  }

  for (const school of root ? objects(root['etablissements']) : objects(data)) {
    const schoolId = pickText(school, 'id')
    if (schoolId === '') continue
    catalog.schools.push({ id: schoolId, code: pickText(school, 'code'), name: pickText(school, 'nom', 'libelle') })

    for (const slot of objects(asObject(school['parametres'])?.['grille'])) {
      const start = pickText(slot, 'heureDbt', 'heureDebut')
      const end = pickText(slot, 'heureFin')
      if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) continue
      const key = `${start}-${end}`
      if (seenSlots.has(key)) continue
      seenSlots.add(key)
      catalog.attendanceSlots.push({ start, end })
    }

    for (const level of objects(school['niveaux'])) {
      for (const raw of objects(level['classes'])) add(groupFrom(raw, 'C', schoolId, teacher))
      for (const raw of objects(level['groupes'])) add(groupFrom(raw, 'G', schoolId, teacher))
    }
  }

  // Les groupes rangés à la racine ne valent que rattachés à un établissement.
  if (root) {
    for (const raw of [...objects(root['groupes']), ...objects(root['autresGroupes'])]) {
      const schoolId = pickText(raw, 'etabId')
      if (schoolId !== '') add(groupFrom(raw, 'G', schoolId, teacher))
    }
  }

  catalog.attendanceSlots.sort((left, right) => left.start.localeCompare(right.start))
  catalog.groups.sort((left, right) => left.kind.localeCompare(right.kind) || left.label.localeCompare(right.label, 'fr'))
  return catalog
}

// ————————————————————————————————————————————————————————— élèves

function byName<T extends { lastName: string; firstName: string }>(left: T, right: T): number {
  return left.lastName.localeCompare(right.lastName, 'fr') || left.firstName.localeCompare(right.firstName, 'fr')
}

/** La liste des élèves d'une classe ou d'un groupe : un tableau, ou un objet qui le range sous `eleves`. */
export function parsePupils(data: unknown): Pupil[] {
  const list = Array.isArray(data) ? data : asObject(data)?.['eleves']
  const pupils: Pupil[] = []
  for (const raw of objects(list)) {
    const id = pickText(raw, 'id')
    const firstName = pickText(raw, 'prenom')
    const lastName = pickText(raw, 'nom')
    if (id === '' || `${firstName}${lastName}` === '') continue
    const nested = asObject(raw['classe'])
    const pupil: Pupil = {
      id,
      firstName,
      lastName,
      sex: pickText(raw, 'sexe').toUpperCase(),
      className: pickText(raw, 'classeLibelle') || (nested ? pickText(nested, 'libelle', 'code') : text(raw['classe'])),
      regime: pickText(raw, 'regime'),
      photo: pickText(raw, 'photo'),
      supports: objects(raw['dispositifs'])
        .map((entry) => pickText(entry, 'libelle', 'label', 'code'))
        .filter((label) => label !== ''),
      dispensed: pickBool(raw, ['dispense']),
    }
    const birthDate = pickDate(raw, 'dateNaissance')
    const leftOn = pickDate(raw, 'dateSortie')
    if (birthDate) pupil.birthDate = birthDate
    if (leftOn) pupil.leftOn = leftOn
    pupils.push(pupil)
  }
  return pupils.sort(byName)
}

// ————————————————————————————————————————————————————————— cahier de textes

function documentsOf(source: Json, ...keys: string[]): Attachment[] {
  return keys.flatMap((key) => parseAttachments(source[key], 'homework'))
}

function slotContent(raw: Json | null, ...documentKeys: string[]): SlotContent | undefined {
  if (!raw) return undefined
  const content = readableContent(raw['contenu'])
  const attachments = documentsOf(raw, ...documentKeys)
  if (content === '' && attachments.length === 0) return undefined
  return { id: pickText(raw, 'idDevoir', 'id'), content, attachments }
}

/**
 * Les séances de `cahierdetexte/loadslots`.
 *
 * `contenuDeSeance` est tantôt un drapeau, tantôt l'objet lui-même : seul un objet est lu
 * comme un contenu, sinon une case cochée deviendrait une séance vide.
 */
export function parseLessonSlots(data: unknown): LessonSlot[] {
  const slots: LessonSlot[] = []
  for (const raw of objects(data)) {
    const start = pickDateTime(raw, 'start_date', 'startDate')
    const end = pickDateTime(raw, 'end_date', 'endDate')
    if (!start || !end) continue
    const group: TeachingGroupRef = {
      kind: kindOf(raw['entityType'], 'C'),
      id: pickText(raw, 'entityId'),
      code: pickText(raw, 'entityCode'),
      label: pickText(raw, 'entityLibelle', 'entityCode'),
    }
    const slot: LessonSlot = {
      id: pickText(raw, 'idCours') || `${start}-${group.id}`,
      date: pickDate(raw, 'date') ?? start.slice(0, 10),
      start,
      end,
      group,
      room: pickText(raw, 'salle'),
      subjectCode: pickText(raw, 'matiereCode', 'codeMatiere'),
      subject: pickText(raw, 'matiereLibelle', 'matiere'),
      exam: pickBool(raw, ['interrogation']),
    }

    const homeworkRaw = asObject(raw['aFaire'])
    const homework = slotContent(homeworkRaw, 'ressourceDocuments', 'documents')
    if (homework && homeworkRaw) {
      const detailed: HomeworkContent = { ...homework, onlineSubmission: pickBool(homeworkRaw, ['rendreEnLigne']) }
      const givenOn = pickDate(homeworkRaw, 'donneLe')
      if (givenOn) detailed.givenOn = givenOn
      slot.homework = detailed
    }
    const session = slotContent(asObject(raw['seance']) ?? asObject(raw['contenuDeSeance']), 'documents')
    if (session) slot.session = session

    slots.push(slot)
  }
  return slots.sort((left, right) => left.start.localeCompare(right.start) || left.group.label.localeCompare(right.group.label, 'fr'))
}

// ————————————————————————————————————————————————————————— notes

function assessmentFrom(raw: Json): Assessment | null {
  const id = pickText(raw, 'id', 'idDevoir')
  if (id === '') return null
  const type = asObject(raw['typeDevoir'])
  const assessment: Assessment = {
    id,
    label: pickText(raw, 'libelle', 'devoirLibelle') || 'Évaluation',
    coefficient: pickNumber(raw, 'coef') ?? 1,
    scale: pickNumber(raw, 'noteSur') ?? 20,
    counted: !pickBool(raw, ['nonSignificatif']),
    graded: pickBool(raw, ['avecNote'], true),
    // `typeDevoir: {}` veut dire « pas de type », pas un type sans nom.
    kind: type ? pickText(type, 'libelle', 'code') : '',
    author: pickText(raw, 'nomProf'),
    comment: pickText(raw, 'commentaire'),
    periodCode: pickText(raw, 'idPeriode'),
  }
  const date = pickDate(raw, 'date')
  if (date) assessment.date = date
  return assessment
}

function markFrom(raw: Json): Mark {
  // La note arrive en chaîne (« 12,5 », « Abs »), parfois en lettre : elle est gardée telle
  // qu'écrite, et seule sa valeur numérique entre dans les calculs.
  const written = text(raw['note']).trim() || pickText(raw, 'lettre').trim()
  const mark: Mark = { raw: written, comment: pickText(raw, 'commentaire') }
  const value = number(written)
  if (value !== undefined) mark.value = value
  return mark
}

/**
 * La grille de notes d'une classe, pour une période et une matière.
 *
 * Les notes d'un élève sont rangées dans un **objet** indexé par évaluation, et non dans un
 * tableau ; quand une note ne rappelle pas son évaluation, c'est sa clé qui la désigne.
 */
export function parseGradebook(data: unknown): Gradebook {
  const root = asObject(data)
  if (!root) return { assessments: [], rows: [] }

  const assessments = objects(root['devoirs'])
    .map(assessmentFrom)
    .filter((entry): entry is Assessment => entry !== null)
    .sort((left, right) => (left.date ?? '9999').localeCompare(right.date ?? '9999'))

  const rows: GradebookRow[] = []
  for (const raw of objects(root['eleves'])) {
    const pupil = asObject(raw['eleve']) ?? raw
    const id = pickText(pupil, 'id')
    if (id === '') continue
    const marks: Record<string, Mark> = {}
    const container = raw['devoirs']
    const entries: Array<[string, unknown]> = Array.isArray(container)
      ? container.map((entry) => [pickText(asObject(entry) ?? {}, 'idDevoir'), entry])
      : Object.entries(asObject(container) ?? {})
    for (const [key, value] of entries) {
      const markRaw = asObject(value)
      if (!markRaw) continue
      const assessmentId = pickText(markRaw, 'idDevoir') || key
      if (assessmentId !== '') marks[assessmentId] = markFrom(markRaw)
    }
    rows.push({
      pupil: {
        id,
        firstName: pickText(pupil, 'prenom'),
        lastName: pickText(pupil, 'nom'),
        className: pickText(pupil, 'classeLibelle', 'codeClasse'),
        sex: pickText(pupil, 'sexe').toUpperCase(),
      },
      marks,
    })
  }
  rows.sort((left, right) => byName(left.pupil, right.pupil))
  return { assessments, rows }
}
