/**
 * Le modèle.
 *
 * Ce que l'application manipule, débarrassé de la forme qu'ÉcoleDirecte lui donne. Tout est
 * en objets simples, sérialisables tels quels : ils traversent le mandataire, dorment dans
 * un cache et repartent vers le navigateur sans conversion.
 *
 * Les dates sont des chaînes ISO (`2026-09-07`, `2026-09-07T10:15:00`) et non des `Date` :
 * un `Date` traversant JSON perd son fuseau et gagne des surprises. Le fuseau de
 * l'établissement est celui de l'élève, jamais celui du serveur.
 */

import type { TeacherProfile } from './teaching.js'

// ————————————————————————————————————————————————————————— comptes

export interface AccountModule {
  code: string
  enabled: boolean
}

export interface Account {
  id: string
  /** `typeCompte` tel que rendu : `E` pour un élève, `P` pour un enseignant, autre chose pour une famille. */
  type: string
  firstName: string
  lastName: string
  className: string
  schoolName: string
  /** Renseigné quand ce profil vient d'un compte famille : l'identifiant du titulaire. */
  familyId?: string
  familyName?: string
  /**
   * Ce que l'établissement a réellement ouvert. C'est la source de vérité des
   * fonctionnalités : rien ne doit être codé en dur par rôle.
   */
  modules: AccountModule[]
  /** Renseigné pour un compte enseignant : ses classes, groupes et matières selon le login. */
  teacher?: TeacherProfile
}

export function isStudent(account: Account): boolean {
  return account.type.toUpperCase() === 'E'
}

export type AccountRole = 'student' | 'family' | 'teacher' | 'unknown'

/**
 * Le rôle d'un compte.
 *
 * `E` pour un élève, c'est établi. Les comptes famille se reconnaissent à leur liste
 * d'enfants, et sont dépliés en un profil par enfant avant d'arriver ici.
 *
 * `P` pour un enseignant : plusieurs clients indépendants qui tournent en réel le lisent
 * ainsi, et l'un d'eux refuse explicitement ce type comme « compte enseignant ». `A` désigne
 * un membre du personnel, que l'application ne prend pas en charge. Ce qui reste à vérifier
 * sur un vrai compte, ce sont les formes des réponses enseignant, pas ce type.
 */
export function accountRole(account: Account): AccountRole {
  const type = account.type.trim().toUpperCase()
  if (type === 'E') return 'student'
  if (type === 'P') return 'teacher'
  if (type === '1' || type === '2' || type === 'F') return 'family'
  return 'unknown'
}

/** Vrai pour un enfant consulté depuis un compte parent. */
export function viewedByFamily(account: Account): boolean {
  return account.familyId !== undefined && account.familyId !== ''
}

/**
 * La boîte aux lettres appartient au titulaire de la connexion, pas au profil consulté :
 * un parent lit la messagerie de la famille, pas celle de son enfant. Confondre les deux
 * fait répondre « accès refusé » à tous les appels.
 */
export function mailboxId(account: Account): string {
  return viewedByFamily(account) ? (account.familyId as string) : account.id
}

export function mailboxSegment(account: Account): 'eleves' | 'familles' {
  return viewedByFamily(account) || !isStudent(account) ? 'familles' : 'eleves'
}

export function displayName(account: Account): string {
  return [account.firstName, account.lastName].filter((part) => part !== '').join(' ')
}

export function initials(account: Account): string {
  const parts = [account.firstName, account.lastName].filter((part) => part !== '')
  return parts.map((part) => part.charAt(0).toUpperCase()).join('') || '?'
}

export function hasModule(account: Account, code: string): boolean {
  const wanted = code.toUpperCase()
  return account.modules.some((module) => module.enabled && module.code.toUpperCase() === wanted)
}

// ————————————————————————————————————————————————————————— emploi du temps

export interface Lesson {
  id: string
  subject: string
  teacher: string
  room: string
  /** ISO local, sans fuseau : `2026-09-07T10:15:00`. */
  start: string
  end: string
  canceled: boolean
  exam: boolean
  note: string
  /** Le groupe quand la classe est scindée — sinon on croit à un doublon. */
  group: string
  kind: string
}

// ————————————————————————————————————————————————————————— cahier de textes

export type AttachmentSource = 'homework' | 'message' | 'resource'

export interface Attachment {
  id: string
  name: string
  type: string
  source: AttachmentSource
  downloadType: string
}

/** Le `leTypeDeFichier` attendu par `telechargement.awp`, selon la provenance. */
export function apiDownloadType(attachment: Attachment): string {
  if (attachment.downloadType !== '') return attachment.downloadType
  switch (attachment.source) {
    case 'homework':
      return 'FICHIER_CDT'
    case 'message':
      return 'PIECE_JOINTE'
    case 'resource':
      return 'CLOUD'
  }
}

export interface HomeworkItem {
  id: string
  subject: string
  /** Date de remise, ISO `2026-09-07`. */
  dueDate: string
  givenOn?: string
  content: string
  exam: boolean
  done: boolean
  attachments: Attachment[]
  /**
   * Le devoir attend un dépôt de copie. L'application ne sait pas déposer — c'est
   * irréversible et invérifiable sans compte de test — mais le taire serait pire : on
   * cocherait une case en croyant avoir rendu.
   */
  onlineSubmission: boolean
}

export interface SessionContent {
  id: string
  subject: string
  date: string
  content: string
  attachments: Attachment[]
}

// ————————————————————————————————————————————————————————— notes

/** Une compétence du socle, évaluée avec la note. */
export interface Skill {
  label: string
  level: string
  value?: number
}

export interface Grade {
  id: string
  subject: string
  label: string
  /** Absente quand la note n'est pas rendue, ou quand c'est une absence justifiée. */
  value?: number
  scale: number
  coefficient: number
  classAverage?: number
  /** Date de saisie distincte du devoir, pour signaler les ajouts récents. */
  enteredOn?: string
  date?: string
  periodCode: string
  /** Fausse quand la note ne compte pas dans la moyenne : le dire évite un calcul faux. */
  counted: boolean
  comment: string
  minimum?: number
  maximum?: number
  kind: string
  skills: Skill[]
}

/** La note ramenée sur 20, seule façon de comparer un /5 et un /40. */
export function outOfTwenty(grade: Grade): number | undefined {
  if (grade.value === undefined || grade.scale <= 0) return undefined
  return (grade.value * 20) / grade.scale
}

export interface Period {
  code: string
  name: string
  average?: number
  classAverage?: number
  start?: string
  end?: string
  current: boolean
  appreciation: string
  headTeacher: string
  councilDate?: string
  councilTime: string
  minimum?: number
  maximum?: number
}

export interface SubjectAverage {
  periodCode: string
  subject: string
  average?: number
  classAverage?: number
  coefficient?: number
  teacher: string
  appreciation: string
  minimum?: number
  maximum?: number
  /** Plusieurs professeurs quand la matière est partagée. */
  teachers: string[]
  /** Renseigné pour une sous-matière (une spécialité sous son tronc commun). */
  parentSubject: string
}

export function isSubSubject(average: SubjectAverage): boolean {
  return average.parentSubject !== ''
}

// ————————————————————————————————————————————————————————— vie scolaire

export type SchoolLifeKind = 'absence' | 'late' | 'sanction' | 'encouragement' | 'other'

export interface SchoolLifeEvent {
  id: string
  kind: SchoolLifeKind
  label: string
  start: string
  end?: string
  justified: boolean
  reason: string
  comment: string
  /** La durée telle que l'établissement la compte, et non telle qu'on la recalculerait. */
  duration: string
}

// ————————————————————————————————————————————————————————— messagerie

export type MessageFolder = 'received' | 'sent' | 'archived'

export const MESSAGE_FOLDERS: MessageFolder[] = ['received', 'sent', 'archived']

export const MESSAGE_FOLDER_LABELS: Record<MessageFolder, string> = {
  received: 'Reçus',
  sent: 'Envoyés',
  archived: 'Archivés',
}

/** Le paramètre `typeRecuperation` attendu par le service. */
export const MESSAGE_FOLDER_PARAM: Record<MessageFolder, string> = {
  received: 'received',
  sent: 'sent',
  archived: 'archived',
}

export interface MessageItem {
  id: string
  subject: string
  sender: string
  date?: string
  read: boolean
  preview: string
  body: string
  attachments: Attachment[]
  folder: MessageFolder
  recipients: string[]
}

/**
 * L'autre bout de la conversation.
 *
 * Dans les envoyés, c'est le destinataire : afficher « moi » en tête de chaque message
 * n'apprendrait rien.
 */
export function counterpart(message: MessageItem): string {
  if (message.folder !== 'sent') return message.sender
  if (message.recipients.length === 0) return message.sender
  if (message.recipients.length === 1) return message.recipients[0] as string
  return `${message.recipients[0] as string} +${message.recipients.length - 1}`
}

export interface MessageClassifier {
  id: string
  label: string
}

// ————————————————————————————————————————————————————————— autres modules

export interface Document {
  id: string
  name: string
  category: string
  date?: string
  type: string
}

export interface NewsItem {
  id: string
  title: string
  content: string
  date?: string
  author: string
  category: string
  attachments: Attachment[]
}

export interface Textbook {
  id: string
  title: string
  subject: string
  publisher: string
  url: string
}

export interface CloudFile {
  id: string
  name: string
  /** Chemin aplati : l'arborescence complète n'apporte rien sur un téléphone. */
  folder: string
  date?: string
  size?: number
  ownerId: string
  /** Faux pour un dossier : on ne télécharge pas un dossier. */
  file: boolean
}

export function documentAsAttachment(document: Document): Attachment {
  return { id: document.id, name: document.name, type: document.type, source: 'resource', downloadType: '' }
}

export function cloudFileAsAttachment(file: CloudFile): Attachment {
  return { id: file.id, name: file.name, type: 'CLOUD', source: 'resource', downloadType: 'CLOUD' }
}
