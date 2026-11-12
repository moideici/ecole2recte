import { env } from '$env/dynamic/private'
import {
  type HttpEngine,
  type HttpRequest,
  type HttpResponse,
  addDays,
  base64Encode,
  daysBetween,
  schoolYear,
  startOfWeek,
} from '@ecole2recte/protocol'

/**
 * L'espace de démonstration.
 *
 * Un faux serveur ÉcoleDirecte, branché à la place du moteur réseau : les pages, le mandataire
 * et les lecteurs tournent exactement comme en réel, sur des réponses qui ont la forme de
 * celles du service. Rien ne part sur le réseau, et **toutes les données sont inventées**,
 * noms compris.
 *
 * Il sert à montrer les deux espaces — élève et professeur — à qui n'a pas encore branché son
 * compte, et à les tester sans en avoir.
 *
 * Côté élève, il fabrique **exprès** le cas que l'arbitrage des moyennes doit reconnaître :
 * une matière dont la moyenne publiée ignore la dernière note, et une autre sans moyenne
 * publiée du tout. Une démonstration prouve quelque chose ou ne sert à rien.
 */

export function demoEnabled(): boolean {
  const value = (env['ED_DEMO'] ?? '').trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'oui'
}

const TEACHER_ID = 5517
const ME = { id: TEACHER_ID, role: 'P', civilite: 'Mme', prenom: 'Claire', particule: '', nom: 'Martin' }

interface DemoGroup {
  kind: 'C' | 'G'
  id: number
  code: string
  label: string
  size: number
  /** Âge des élèves à la rentrée : sert à inventer des dates de naissance plausibles. */
  age: number
  classes: string[]
  headTeacher: boolean
}

const GROUPS: DemoGroup[] = [
  { kind: 'C', id: 812, code: '2GT3', label: 'Seconde 3', size: 30, age: 15, classes: ['Seconde 3'], headTeacher: true },
  { kind: 'C', id: 815, code: '2GT6', label: 'Seconde 6', size: 28, age: 15, classes: ['Seconde 6'], headTeacher: false },
  { kind: 'G', id: 901, code: 'SPE-MATH-1', label: 'Spé maths 1re', size: 22, age: 16, classes: ['1re G1', '1re G2', '1re G4'], headTeacher: false },
  { kind: 'G', id: 902, code: 'MATHS-EXP', label: 'Maths expertes Tle', size: 14, age: 17, classes: ['Tle G1', 'Tle G3'], headTeacher: false },
]

export const DEMO_LOGIN = {
  accounts: [
    {
      id: TEACHER_ID,
      idLogin: 880001,
      typeCompte: 'P',
      prenom: 'Claire',
      nom: 'Martin',
      nomEtablissement: 'Lycée Victor Hugo (démo)',
      isProfEtPersonnel: false,
      main: true,
      modules: ['EDT', 'CAHIER_DE_TEXTES', 'CARNET_NOTES', 'MESSAGERIE', 'VIE_SCOLAIRE'].map((code) => ({ code, enable: true })),
      profile: {
        classes: GROUPS.filter((group) => group.kind === 'C').map((group) => ({ id: group.id, code: group.code, libelle: group.label })),
        groupesNiveau: GROUPS.filter((group) => group.kind === 'G').map((group) => ({
          id: group.id,
          code: group.code,
          libelle: group.label,
          idClasse: 0,
          codeMatiere: 'MATHS',
        })),
        matieres: [{ code: 'MATHS', libelle: 'Mathématiques' }],
      },
    },
  ],
}

/** La semaine type, du lundi (0) au vendredi (4). */
const WEEK: Array<{ day: number; start: string; end: string; group: number; room: string }> = [
  { day: 0, start: '08:00', end: '08:55', group: 812, room: 'B204' },
  { day: 0, start: '09:00', end: '09:55', group: 815, room: 'B204' },
  { day: 0, start: '10:10', end: '12:05', group: 901, room: 'C011' },
  { day: 0, start: '14:00', end: '14:55', group: 902, room: 'C011' },
  { day: 1, start: '08:00', end: '09:55', group: 901, room: 'C011' },
  { day: 1, start: '13:00', end: '13:55', group: 812, room: 'B204' },
  { day: 1, start: '14:00', end: '14:55', group: 815, room: 'B204' },
  { day: 2, start: '08:00', end: '08:55', group: 815, room: 'B204' },
  { day: 2, start: '09:00', end: '09:55', group: 812, room: 'B204' },
  { day: 2, start: '10:10', end: '11:05', group: 902, room: 'C011' },
  { day: 3, start: '10:10', end: '12:05', group: 901, room: 'C011' },
  { day: 3, start: '15:00', end: '15:55', group: 815, room: 'B106' },
  { day: 4, start: '08:00', end: '08:55', group: 812, room: 'B204' },
  { day: 4, start: '09:00', end: '10:55', group: 901, room: 'C011' },
  { day: 4, start: '13:00', end: '13:55', group: 902, room: 'C011' },
]

const TOPICS: Record<number, string[]> = {
  812: ['Ensembles de nombres', 'Intervalles et inégalités', 'Puissances et racines carrées', 'Développer et factoriser', 'Équations produit nul'],
  815: ['Ensembles de nombres', 'Intervalles et inégalités', 'Puissances et racines carrées', 'Développer et factoriser', 'Équations produit nul'],
  901: ['Second degré : forme canonique', 'Discriminant et racines', 'Signe d’un trinôme', 'Suites : modes de génération', 'Suites arithmétiques'],
  902: ['Nombres complexes : forme algébrique', 'Conjugué et module', 'Divisibilité dans ℤ', 'Congruences', 'PGCD et algorithme d’Euclide'],
}

const GIRLS = ['Léa', 'Emma', 'Chloé', 'Inès', 'Jade', 'Louise', 'Manon', 'Camille', 'Sarah', 'Lina', 'Zoé', 'Anaïs', 'Clara', 'Nour', 'Maëlys']
const BOYS = ['Adam', 'Lucas', 'Hugo', 'Nathan', 'Yanis', 'Léo', 'Gabriel', 'Ethan', 'Noah', 'Rayan', 'Tom', 'Mathis', 'Sacha', 'Karim', 'Théo']
const FAMILY_NAMES = [
  'Bernard', 'Aubert', 'Dubois', 'Lefèvre', 'Moreau', 'Garcia', 'Roux', 'Fontaine', 'Chevalier', 'Benali',
  'Nguyen', 'Lambert', 'Faure', 'Mercier', 'Blanc', 'Guérin', 'Boyer', 'Girard', 'Perrin', 'Marchand',
  'Diallo', 'Rousseau', 'Colin', 'Vidal', 'Caron', 'Picard', 'Renaud', 'Barbier', 'Arnaud', 'Lemoine',
]

/** Un aléa reproductible : la même classe garde les mêmes élèves et les mêmes notes d'une page à l'autre. */
function random(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function groupById(id: number): DemoGroup | undefined {
  return GROUPS.find((group) => group.id === id)
}

// ————————————————————————————————————————————————————————— emploi du temps

function occurrences(from: string, to: string) {
  const found: Array<{ date: string; start: string; end: string; group: DemoGroup; room: string; index: number; week: number }> = []
  for (let monday = startOfWeek(from); monday <= to; monday = addDays(monday, 7)) {
    const week = Math.floor(Date.parse(`${monday}T00:00:00Z`) / (7 * 86400000))
    WEEK.forEach((slot, index) => {
      const date = addDays(monday, slot.day)
      const group = groupById(slot.group)
      if (date < from || date > to || !group) return
      found.push({ date, start: slot.start, end: slot.end, group, room: slot.room, index, week })
    })
  }
  return found
}

function slotId(date: string, index: number): number {
  return Number(date.replaceAll('-', '')) * 100 + index
}

function timetable(from: string, to: string, today: string) {
  return occurrences(from, to).map((slot) => ({
    id: slotId(slot.date, slot.index),
    text: 'MATHEMATIQUES',
    matiere: 'Mathématiques',
    codeMatiere: 'MATHS',
    typeCours: 'COURS',
    start_date: `${slot.date} ${slot.start}`,
    end_date: `${slot.date} ${slot.end}`,
    prof: 'MARTIN C.',
    salle: slot.room,
    classe: slot.group.kind === 'C' ? slot.group.label : '',
    classeId: slot.group.kind === 'C' ? slot.group.id : 0,
    groupe: slot.group.kind === 'G' ? slot.group.label : '',
    groupeId: slot.group.kind === 'G' ? slot.group.id : 0,
    // Un cours annulé dans la semaine en cours, pour montrer qu'il reste affiché.
    isAnnule: slot.index === 9 && startOfWeek(slot.date) === startOfWeek(today),
    contenuDeSeance: slot.date <= today,
  }))
}

function lessonSlots(from: string, to: string, today: string) {
  return occurrences(from, to).map((slot) => {
    const id = slotId(slot.date, slot.index)
    const topics = TOPICS[slot.group.id] ?? ['Cours']
    const topic = topics[(slot.week + slot.index) % topics.length] as string
    const withHomework = slot.index % 2 === 0
    const first = 10 + ((slot.week * 3 + slot.index) % 30)
    return {
      idCours: id,
      idCDT: id,
      date: slot.date,
      start_date: `${slot.date} ${slot.start}`,
      end_date: `${slot.date} ${slot.end}`,
      entityId: slot.group.id,
      entityCode: slot.group.code,
      entityLibelle: slot.group.label,
      entityType: slot.group.kind,
      salle: slot.room,
      matiereCode: 'MATHS',
      matiereLibelle: 'Mathématiques',
      interrogation: slot.index === 12,
      travailAFaire: withHomework,
      contenuDeSeance: slot.date <= today,
      ...(withHomework
        ? {
            aFaire: {
              idDevoir: id * 10 + 1,
              contenu: base64Encode(`<p>Exercices ${first} à ${first + 5} page ${40 + first}.</p>`),
              rendreEnLigne: false,
              donneLe: addDays(slot.date, -2),
              effectue: false,
              ressourceDocuments: [],
            },
          }
        : {}),
      ...(slot.date <= today
        ? {
            seance: {
              idDevoir: id * 10 + 2,
              contenu: base64Encode(`<p>${topic}.</p><p>Cours, exemples, puis exercices d’application en autonomie.</p>`),
              documents: [],
            },
          }
        : {}),
    }
  })
}

// ————————————————————————————————————————————————————————— catalogue et élèves

function periods(today: string) {
  const first = Number(schoolYear(today).slice(0, 4))
  return [
    { codePeriode: 'A001', libelle: 'Trimestre 1', libelleCourt: 'T1', dateDebut: `${first}-09-01`, dateFin: `${first}-11-30`, dateConseil: `${first}-12-08` },
    { codePeriode: 'A002', libelle: 'Trimestre 2', libelleCourt: 'T2', dateDebut: `${first}-12-01`, dateFin: `${first + 1}-02-28`, dateConseil: `${first + 1}-03-09` },
    { codePeriode: 'A003', libelle: 'Trimestre 3', libelleCourt: 'T3', dateDebut: `${first + 1}-03-01`, dateFin: `${first + 1}-07-04`, dateConseil: `${first + 1}-06-11` },
  ].map((period) => ({
    ...period,
    etat: today > period.dateFin ? 'cloture' : 'ouvert',
    saisieAppreciation: true,
    matieres: [{ code: 'MATHS', libelle: 'Mathématiques', libelleCourt: 'MATHS', avecNotation: true, isEditable: 'Si non vide' }],
  }))
}

function catalog(today: string) {
  const entity = (group: DemoGroup) => ({
    idGroupe: group.id,
    code: group.code,
    libelle: group.label,
    typeEntity: group.kind,
    isPP: group.headTeacher,
    tabPP: group.headTeacher ? [{ idPP: TEACHER_ID }] : [],
    periodes: periods(today),
  })
  const grid = ['08:00-08:55', '09:00-09:55', '10:10-11:05', '11:10-12:05', '13:00-13:55', '14:00-14:55', '15:00-15:55', '16:10-17:05']
  return {
    etablissements: [
      {
        id: 1,
        code: 'VH',
        nom: 'Lycée Victor Hugo (démo)',
        parametres: { grille: grid.map((slot) => ({ heureDbt: slot.slice(0, 5), heureFin: slot.slice(6) })) },
        niveaux: [{ code: '2NDE', libelle: 'Seconde', classes: GROUPS.filter((group) => group.kind === 'C').map(entity), groupes: [] }],
      },
    ],
    groupes: GROUPS.filter((group) => group.kind === 'G').map((group) => ({ ...entity(group), etabId: 1 })),
    autresGroupes: [],
  }
}

function pupils(group: DemoGroup, today: string) {
  const rand = random(group.id)
  const first = Number(schoolYear(today).slice(0, 4))
  return Array.from({ length: group.size }, (_, index) => {
    const girl = rand() < 0.5
    const names = girl ? GIRLS : BOYS
    return {
      id: group.id * 100 + index + 1,
      prenom: names[Math.floor(rand() * names.length)] as string,
      nom: FAMILY_NAMES[(index * 7 + group.id) % FAMILY_NAMES.length] as string,
      sexe: girl ? 'F' : 'M',
      classeLibelle: group.classes[index % group.classes.length] as string,
      dateNaissance: `${first - group.age}-${pad(1 + Math.floor(rand() * 12))}-${pad(1 + Math.floor(rand() * 28))}`,
      regime: rand() < 0.65 ? 'Demi-pensionnaire' : 'Externe',
      photo: '',
      dispositifs: rand() < 0.1 ? [{ code: 'PAP', libelle: 'PAP' }] : [],
      dispense: rand() < 0.05,
      dateEntree: `${first}-09-01`,
      dateSortie: '',
    }
  })
}

// ————————————————————————————————————————————————————————— notes

const TYPES = {
  ie: { id: 2, code: 'IE', libelle: 'Interrogation écrite' },
  dm: { id: 3, code: 'DM', libelle: 'Devoir maison' },
  ds: { id: 1, code: 'DS', libelle: 'Devoir surveillé' },
}

const PLAN: Array<{ libelle: string; coef: number; noteSur: number; nonSignificatif?: boolean; type: { id: number; code: string; libelle: string } | null }> = [
  { libelle: 'Évaluation diagnostique', coef: 1, noteSur: 20, nonSignificatif: true, type: null },
  { libelle: 'Interrogation 1', coef: 1, noteSur: 10, type: TYPES.ie },
  { libelle: 'Devoir maison 1', coef: 0.5, noteSur: 20, type: TYPES.dm },
  { libelle: 'Devoir surveillé 1', coef: 2, noteSur: 20, type: TYPES.ds },
  { libelle: 'Interrogation 2', coef: 1, noteSur: 10, type: TYPES.ie },
  { libelle: 'Devoir surveillé 2', coef: 2, noteSur: 20, type: TYPES.ds },
]

function gradebook(group: DemoGroup, periodCode: string, today: string) {
  const period = periods(today).find((entry) => entry.codePeriode === periodCode)
  if (!period || today < period.dateDebut) return { devoirs: [], eleves: [] }

  // En cours de période, les évaluations se resserrent sur les semaines écoulées et la
  // suivante est annoncée sans notes ; une période close est notée d'un bout à l'autre.
  const current = today <= period.dateFin
  const end = current ? today : period.dateFin
  const span = Math.max(daysBetween(period.dateDebut, end), PLAN.length)
  const count = current ? Math.min(PLAN.length - 1, 1 + Math.floor(daysBetween(period.dateDebut, today) / 7)) : PLAN.length
  const planned = PLAN.slice(0, count).map((entry, index) => ({
    ...entry,
    date: jourDeClasse(addDays(period.dateDebut, Math.round(((index + 1) * span) / (count + 1)))),
  }))
  const next = current ? PLAN[count] : undefined
  if (next) planned.push({ ...next, date: jourDeClasse(addDays(today, 5)) })

  const periodIndex = Number(periodCode.slice(-1))
  const devoirs = planned.map((entry, index) => ({
    id: group.id * 100 + periodIndex * 10 + index,
    idProf: TEACHER_ID,
    nomProf: 'Mme C. MARTIN',
    libelle: entry.libelle,
    coef: entry.coef,
    noteSur: entry.noteSur,
    date: entry.date,
    dateAffichage: entry.date,
    nonSignificatif: entry.nonSignificatif === true,
    ccf: false,
    notationLettre: false,
    noteNegative: false,
    statutPeriode: current ? 'ouvert' : 'cloture',
    idPeriode: `${periodCode}X001`,
    codeMatiere: 'MATHS',
    codeSSMatiere: '',
    avecNote: true,
    commentaire: '',
    typeDevoir: entry.type ?? {},
  }))

  const rand = random(group.id * 7 + periodIndex)
  const eleves = pupils(group, today).map((pupil) => {
    const level = 7 + rand() * 11
    const notes: Record<string, unknown> = {}
    for (const devoir of devoirs) {
      if (devoir.date > today) continue
      const roll = rand()
      const onTwenty = Math.min(20, Math.max(0, level + (rand() - 0.5) * 7))
      const note = roll < 0.04 ? 'Abs' : String(Math.round(((onTwenty * devoir.noteSur) / 20) * 2) / 2).replace('.', ',')
      notes[String(devoir.id)] = {
        idNote: devoir.id * 10000 + pupil.id,
        idDevoir: devoir.id,
        idPeriode: devoir.idPeriode,
        coef: devoir.coef,
        note,
        noteSur: devoir.noteSur,
        date: devoir.date,
        devoirLibelle: devoir.libelle,
        codeMatiere: 'MATHS',
        codeSSMatiere: '',
        commentaire: roll > 0.97 ? 'Rendu en retard' : '',
      }
    }
    return {
      eleve: { id: pupil.id, prenom: pupil.prenom, nom: pupil.nom, classeLibelle: pupil.classeLibelle, sexe: pupil.sexe, photo: '' },
      devoirs: notes,
    }
  })
  return { devoirs, eleves }
}

// ————————————————————————————————————————————————————————— messagerie

interface DemoMessage {
  id: number
  daysAgo: number
  time: string
  person: { id: number; role: string; civilite: string; prenom: string; nom: string; fonctionPersonnel?: string }
  subject: string
  html: string
  read: boolean
}

const RECEIVED: DemoMessage[] = [
  {
    id: 9101,
    daysAgo: 0,
    time: '07:42',
    person: { id: 301, role: 'A', civilite: '', prenom: '', nom: 'Vie scolaire', fonctionPersonnel: 'CPE' },
    subject: 'Absences de la semaine en Seconde 3',
    html: '<p>Bonjour,</p><p>Vous trouverez ci-dessous le récapitulatif des absences de la semaine pour la Seconde 3. Merci de nous signaler toute erreur.</p><p>Bonne journée,<br>La vie scolaire</p>',
    read: false,
  },
  {
    id: 9102,
    daysAgo: 1,
    time: '18:05',
    person: { id: 402, role: '1', civilite: 'Mme', prenom: 'Sophie', nom: 'Durand' },
    subject: 'Demande de rendez-vous',
    html: '<p>Bonjour Madame,</p><p>Serait-il possible de vous rencontrer pour faire le point sur le début d’année de mon fils ?</p><p>Cordialement,<br>Sophie Durand</p>',
    read: false,
  },
  {
    id: 9103,
    daysAgo: 2,
    time: '12:30',
    person: { id: 303, role: 'A', civilite: 'M.', prenom: 'Paul', nom: 'Lemaire', fonctionPersonnel: 'Proviseur adjoint' },
    subject: 'Conseil pédagogique de jeudi',
    html: '<p>Chères et chers collègues,</p><p>Le conseil pédagogique se tiendra jeudi à 17 h 30 en salle polyvalente. L’ordre du jour suivra.</p><p>Paul Lemaire</p>',
    read: true,
  },
  {
    id: 9104,
    daysAgo: 4,
    time: '09:15',
    person: { id: 204, role: 'P', civilite: 'M.', prenom: 'Karim', nom: 'Haddad' },
    subject: 'Progression commune en Seconde',
    html: '<p>Bonjour Claire,</p><p>Je te propose qu’on cale la progression de Seconde avant les vacances : le chapitre sur les fonctions de référence pourrait passer avant les vecteurs.</p><p>Karim</p>',
    read: true,
  },
  {
    id: 9105,
    daysAgo: 7,
    time: '16:48',
    person: { id: 305, role: 'A', civilite: '', prenom: '', nom: 'Secrétariat de direction' },
    subject: 'Emploi du temps définitif',
    html: '<p>Bonjour,</p><p>Les emplois du temps définitifs sont en ligne. Les changements de salle prennent effet lundi.</p><p>Le secrétariat</p>',
    read: true,
  },
]

const SENT: DemoMessage[] = [
  {
    id: 9201,
    daysAgo: 1,
    time: '20:12',
    person: { id: 402, role: '1', civilite: 'Mme', prenom: 'Sophie', nom: 'Durand' },
    subject: 'RE: Demande de rendez-vous',
    html: '<p>Bonjour Madame,</p><p>Avec plaisir : jeudi à 17 h en salle B204, cela vous conviendrait-il ?</p><p>Cordialement,<br>Claire Martin</p>',
    read: true,
  },
]

/** Les deux bouts d'une conversation : qui écrit, et la boîte qu'on regarde. */
interface DemoMailbox {
  me: { id: number; role: string; civilite: string; prenom: string; particule: string; nom: string }
  received: DemoMessage[]
  sent: DemoMessage[]
}

const TEACHER_MAILBOX: DemoMailbox = { me: ME, received: RECEIVED, sent: SENT }

function messageFor(entry: DemoMessage, folder: string, today: string, box: DemoMailbox = TEACHER_MAILBOX) {
  const person = { particule: '', fonctionPersonnel: '', ...entry.person, to_cc_cci: 'to', read: true }
  const me = { ...box.me, fonctionPersonnel: '', to_cc_cci: 'to', read: entry.read }
  return {
    id: entry.id,
    mtype: folder,
    read: entry.read,
    subject: entry.subject,
    content: base64Encode(entry.html),
    date: `${addDays(today, -entry.daysAgo)} ${entry.time}:00`,
    brouillon: false,
    transferred: false,
    answered: false,
    idClasseur: 0,
    idDossier: -1,
    from: folder === 'sent' ? me : person,
    to: folder === 'sent' ? [person] : [me],
    files: [],
    canAnswer: true,
  }
}

function messages(folder: string, page: number, today: string, box: DemoMailbox = TEACHER_MAILBOX) {
  const source = folder === 'received' ? box.received : folder === 'sent' ? box.sent : []
  const list = page > 0 ? [] : source.map((entry) => messageFor(entry, folder, today, box))
  return {
    classeurs: [],
    pagination: {
      messagesRecusCount: box.received.length,
      messagesEnvoyesCount: box.sent.length,
      messagesArchivesCount: 0,
      messagesRecusNotReadCount: box.received.filter((entry) => !entry.read).length,
      messagesDraftCount: 0,
    },
    messages: { received: [], sent: [], archived: [], draft: [], [folder]: list },
  }
}

// ————————————————————————————————————————————————————————— l'espace élève

const STUDENT = { id: 4021, prenom: 'Camille', nom: 'Bernard', classe: 'Première G2' }
const SCHOOL = 'Lycée Victor Hugo (démo)'

export const DEMO_STUDENT_LOGIN = {
  accounts: [
    {
      id: STUDENT.id,
      idLogin: 770001,
      typeCompte: 'E',
      prenom: STUDENT.prenom,
      nom: STUDENT.nom,
      nomEtablissement: SCHOOL,
      main: true,
      modules: ['EDT', 'CAHIER_DE_TEXTES', 'NOTES', 'VIE_SCOLAIRE', 'MESSAGERIE', 'DOCUMENTS_ELEVE', 'CLOUD'].map(
        (code) => ({ code, enable: true }),
      ),
      profile: { classe: { code: '1G2', libelle: STUDENT.classe } },
    },
  ],
}

interface DemoSubject {
  code: string
  label: string
  coef: number
  teacher: string
  room: string
  /** Le niveau autour duquel les notes sont tirées : une classe n'est pas uniforme. */
  level: number
  /**
   * La moyenne du bulletin est celle d'**avant** la dernière note — le cas que
   * l'application doit reconnaître et rattraper.
   */
  enRetard?: boolean
  /** L'établissement ne publie pas de moyenne dans cette matière. */
  sansMoyenne?: boolean
}

const SUBJECTS: DemoSubject[] = [
  { code: 'FRAN', label: 'Français', coef: 4, teacher: 'Mme ROUX', room: 'A112', level: 12.4 },
  { code: 'MATH', label: 'Mathématiques', coef: 4, teacher: 'M. PETIT', room: 'B204', level: 12.2, enRetard: true },
  { code: 'HIGE', label: 'Histoire-Géographie', coef: 3, teacher: 'M. BLANC', room: 'A203', level: 14.2 },
  { code: 'ANGL', label: 'Anglais LV1', coef: 3, teacher: 'Mme GARCIA', room: 'C105', level: 15.1 },
  { code: 'PHCH', label: 'Physique-Chimie', coef: 3, teacher: 'M. NGUYEN', room: 'D002', level: 11.8 },
  { code: 'SVT', label: 'SVT', coef: 3, teacher: 'Mme FAURE', room: 'D014', level: 13.1 },
  { code: 'SES', label: 'Sciences économiques et sociales', coef: 3, teacher: 'Mme LAMBERT', room: 'A305', level: 12.9 },
  { code: 'EPS', label: 'EPS', coef: 2, teacher: 'M. MERCIER', room: 'Gymnase', level: 16, sansMoyenne: true },
]

function subjectOf(code: string): DemoSubject {
  return SUBJECTS.find((entry) => entry.code === code) as DemoSubject
}

/** Ramène une date au vendredi précédent si elle tombe un week-end : on n'évalue pas le dimanche. */
function jourDeClasse(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  if (day === 6) return addDays(date, -1)
  if (day === 0) return addDays(date, -2)
  return date
}

/** La semaine type de la classe, du lundi (0) au vendredi (4). */
const STUDENT_WEEK: Array<{ day: number; start: string; end: string; code: string }> = [
  { day: 0, start: '08:00', end: '09:55', code: 'FRAN' },
  { day: 0, start: '10:10', end: '11:05', code: 'MATH' },
  { day: 0, start: '11:10', end: '12:05', code: 'ANGL' },
  { day: 0, start: '13:00', end: '14:55', code: 'PHCH' },
  { day: 0, start: '15:00', end: '15:55', code: 'HIGE' },
  { day: 1, start: '08:00', end: '09:55', code: 'MATH' },
  { day: 1, start: '10:10', end: '11:05', code: 'SES' },
  { day: 1, start: '11:10', end: '12:05', code: 'SVT' },
  { day: 1, start: '14:00', end: '15:55', code: 'EPS' },
  { day: 2, start: '08:00', end: '08:55', code: 'ANGL' },
  { day: 2, start: '09:00', end: '09:55', code: 'FRAN' },
  { day: 2, start: '10:10', end: '12:05', code: 'SVT' },
  { day: 3, start: '08:00', end: '09:55', code: 'SES' },
  { day: 3, start: '10:10', end: '11:05', code: 'MATH' },
  { day: 3, start: '11:10', end: '12:05', code: 'HIGE' },
  { day: 3, start: '13:00', end: '13:55', code: 'PHCH' },
  { day: 3, start: '14:00', end: '14:55', code: 'FRAN' },
  { day: 4, start: '08:00', end: '09:55', code: 'HIGE' },
  { day: 4, start: '10:10', end: '11:05', code: 'PHCH' },
  { day: 4, start: '11:10', end: '12:05', code: 'ANGL' },
  { day: 4, start: '13:00', end: '14:55', code: 'SES' },
]

function studentPeriods(today: string) {
  const first = Number(schoolYear(today).slice(0, 4))
  return [
    { code: 'A001', label: 'Trimestre 1', from: `${first}-09-01`, to: `${first}-11-30`, council: `${first}-12-08` },
    { code: 'A002', label: 'Trimestre 2', from: `${first}-12-01`, to: `${first + 1}-02-28`, council: `${first + 1}-03-09` },
    { code: 'A003', label: 'Trimestre 3', from: `${first + 1}-03-01`, to: `${first + 1}-07-04`, council: `${first + 1}-06-11` },
  ]
}

const GRADE_PLAN = [
  { libelle: 'Évaluation de rentrée', coef: 1, sur: 20, type: 'Interrogation écrite', horsMoyenne: true },
  { libelle: 'Interrogation 1', coef: 1, sur: 10, type: 'Interrogation écrite' },
  { libelle: 'Devoir surveillé 1', coef: 2, sur: 20, type: 'Devoir surveillé' },
  { libelle: 'Devoir maison', coef: 1, sur: 20, type: 'Devoir maison' },
  { libelle: 'Interrogation 2', coef: 1, sur: 10, type: 'Interrogation écrite' },
  { libelle: 'Devoir surveillé 2', coef: 2, sur: 20, type: 'Devoir surveillé' },
]

interface DemoGrade {
  id: number
  libelle: string
  type: string
  coef: number
  sur: number
  date: string
  /** Absente pour une absence : « Abs » n'est pas un zéro. */
  valeur?: number
  horsMoyenne: boolean
  classe: number
  min: number
  max: number
}

/** Les notes d'une matière sur une période, tirées d'un aléa reproductible. */
function gradesOf(subject: DemoSubject, periodIndex: number, from: string, to: string, today: string): DemoGrade[] {
  const fin = today < to ? today : to
  if (fin < from) return []
  // Le rang dans la liste, et pas une lettre du code : « SVT » et « SES » commencent
  // pareil, et deux notes qui partagent un identifiant cassent tout affichage par clé.
  const rang = SUBJECTS.indexOf(subject)
  const rand = random((rang + 1) * 977 + periodIndex * 7919)
  const semaines = Math.max(1, Math.floor(daysBetween(from, fin) / 7))
  // Trois notes au moins, sans quoi la démonstration n'a rien à montrer : la première ne
  // compte pas dans la moyenne, et il en faut deux pour qu'une moyenne en retard se voie.
  const combien = Math.min(GRADE_PLAN.length, Math.max(3, 1 + semaines))
  const span = Math.max(daysBetween(from, fin), combien)

  return GRADE_PLAN.slice(0, combien).map((entry, index) => {
    const dernier = index === combien - 1
    // La matière « en retard » finit sur une note nettement au-dessus : c'est elle que la
    // moyenne du bulletin n'a pas encore prise en compte, et l'écart doit se voir.
    const cible = subject.enRetard && dernier ? subject.level + 5.5 : subject.level + (rand() - 0.5) * 6
    const sur20 = Math.min(20, Math.max(2, Math.round(cible * 2) / 2))
    const absent = !dernier && rand() < 0.07
    const grade: DemoGrade = {
      id: 60000 + rang * 1000 + periodIndex * 100 + index,
      libelle: entry.libelle,
      type: entry.type,
      coef: entry.coef,
      sur: entry.sur,
      date: jourDeClasse(addDays(from, Math.round(((index + 1) * span) / (combien + 1)))),
      horsMoyenne: entry.horsMoyenne === true,
      classe: Math.round((subject.level - 0.7) * 10) / 10,
      min: Math.max(0, Math.round((subject.level - 7) * 10) / 10),
      max: Math.min(20, Math.round((subject.level + 5) * 10) / 10),
    }
    if (!absent) grade.valeur = Math.round(((sur20 * entry.sur) / 20) * 2) / 2
    return grade
  })
}

/** La moyenne pondérée sur 20 d'un lot de notes, avec les règles du bulletin. */
function averageOf(grades: DemoGrade[]): number | undefined {
  let total = 0
  let poids = 0
  for (const grade of grades) {
    if (grade.horsMoyenne || grade.valeur === undefined) continue
    total += ((grade.valeur * 20) / grade.sur) * grade.coef
    poids += grade.coef
  }
  return poids === 0 ? undefined : total / poids
}

function comma(value: number, decimals = 2): string {
  return value.toFixed(decimals).replace('.', ',')
}

/**
 * Le relevé de notes.
 *
 * La moyenne publiée par matière est **recalculée ici avec les mêmes règles** que le
 * bulletin — sauf pour la matière marquée « en retard », dont la moyenne publiée ignore la
 * dernière note. C'est exactement la situation que l'application doit reconnaître, et elle
 * est fabriquée ici plutôt que devinée : la démonstration prouve quelque chose ou ne sert
 * à rien.
 */
function studentGrades(today: string) {
  const periodes = studentPeriods(today)
  const notes: unknown[] = []

  const rendu = periodes.map((periode, periodIndex) => {
    const disciplines: unknown[] = []
    const publiees: Array<{ moyenne: number; coef: number }> = []

    for (const subject of SUBJECTS) {
      const grades = gradesOf(subject, periodIndex, periode.from, periode.to, today)
      for (const grade of grades) {
        notes.push({
          id: grade.id,
          devoir: grade.libelle,
          codePeriode: periode.code,
          libelleMatiere: subject.label,
          codeMatiere: subject.code,
          valeur: grade.valeur === undefined ? 'Abs' : comma(grade.valeur, 1),
          noteSur: comma(grade.sur, 0),
          coef: comma(grade.coef, 1),
          moyenneClasse: comma(grade.classe),
          minClasse: comma(grade.min),
          maxClasse: comma(grade.max),
          date: grade.date,
          dateSaisie: today >= periode.from && today <= periode.to && grade === grades[grades.length - 1] ? today : grade.date,
          typeDevoir: grade.type,
          nonSignificatif: grade.horsMoyenne,
          commentaire: grade.horsMoyenne ? 'Évaluation diagnostique, non comptée.' : '',
          elementsProgramme: [],
        })
      }
      if (grades.length === 0) continue

      // Ce que le bulletin publie : tout, ou tout sauf la dernière note.
      const retenues = subject.enRetard ? grades.slice(0, -1) : grades
      const moyenne = subject.sansMoyenne ? undefined : averageOf(retenues)
      const discipline: Record<string, unknown> = {
        codeMatiere: subject.code,
        discipline: subject.label,
        coef: subject.coef,
        professeurs: [{ nom: subject.teacher.replace(/^(M\.|Mme) /, ''), civilite: subject.teacher.split(' ')[0] }],
        appreciations: [{ appreciation: appreciationOf(subject, moyenne ?? subject.level) }],
      }
      if (moyenne !== undefined) {
        discipline['moyenne'] = comma(moyenne)
        discipline['moyenneClasse'] = comma(moyenne - 0.8)
        discipline['moyenneMin'] = comma(Math.max(0, moyenne - 6.2))
        discipline['moyenneMax'] = comma(Math.min(20, moyenne + 4.1))
        publiees.push({ moyenne, coef: subject.coef })
      }
      disciplines.push(discipline)
    }

    // La générale du bulletin découle des moyennes publiées : en retard sur une matière,
    // elle est en retard elle aussi.
    const poids = publiees.reduce((total, entry) => total + entry.coef, 0)
    const generale = poids === 0 ? undefined : publiees.reduce((total, entry) => total + entry.moyenne * entry.coef, 0) / poids

    const raw: Record<string, unknown> = {
      idPeriode: periode.code,
      periode: periode.label,
      cloture: today > periode.to,
      isCurrent: today >= periode.from && today <= periode.to,
      dateDebut: periode.from,
      dateFin: periode.to,
      ensembleMatieres: {
        nomPP: 'Mme ROUX',
        dateConseil: periode.council,
        heureConseil: '17:30',
        appreciationPP:
          today > periode.to ? 'Trimestre sérieux. Des résultats en progression, à confirmer.' : '',
        disciplines,
      },
    }
    if (generale !== undefined) {
      raw['moyenneGenerale'] = comma(generale)
      raw['moyenneClasse'] = comma(generale - 0.6)
      raw['moyenneMin'] = comma(Math.max(0, generale - 5.4))
      raw['moyenneMax'] = comma(Math.min(20, generale + 3.7))
    }
    return raw
  })

  return { periodes: rendu, notes }
}

function appreciationOf(subject: DemoSubject, moyenne: number): string {
  if (moyenne >= 15) return `Excellent trimestre en ${subject.label.toLowerCase()}. Continuez ainsi.`
  if (moyenne >= 12) return 'Ensemble satisfaisant. Le travail régulier paie.'
  return 'Des difficultés persistent. Un travail plus régulier est attendu.'
}

// ——————————————————————————————————————————— cahier de textes de l'élève

const TRAVAUX: Record<string, string[]> = {
  FRAN: ['Lire les chapitres 4 à 6 et relever les figures de style.', 'Rédiger l’introduction du commentaire.'],
  MATH: ['Exercices 22 à 26 page 78.', 'Finir la fiche sur le second degré.'],
  HIGE: ['Apprendre le cours sur la Révolution industrielle.', 'Préparer la carte mentale du chapitre 3.'],
  ANGL: ['Learn the vocabulary list p. 44.', 'Write a 150-word summary of the article.'],
  PHCH: ['Exercices 9 et 12 page 61.', 'Préparer le compte rendu de TP.'],
  SVT: ['Réviser le schéma de la mitose.', 'Terminer le TP sur les enzymes.'],
  SES: ['Lire le document 3 et répondre aux questions.', 'Réviser les définitions du chapitre.'],
  EPS: ['Apporter une tenue adaptée au gymnase.'],
}

/** Les cours d'une journée, tels que l'emploi du temps les place. */
function lessonsOfDay(date: string) {
  const day = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7
  return STUDENT_WEEK.filter((slot) => slot.day === day)
}

function homeworkOn(date: string, today: string) {
  return lessonsOfDay(date)
    .filter((_, index) => (Number(date.replaceAll('-', '')) + index) % 3 === 0)
    .map((slot, index) => {
      const subject = subjectOf(slot.code)
      const textes = TRAVAUX[slot.code] ?? ['Revoir le cours.']
      const texte = textes[(Number(date.slice(-2)) + index) % textes.length] as string
      return {
        idDevoir: Number(date.replaceAll('-', '')) * 10 + index,
        matiere: subject.label,
        codeMatiere: subject.code,
        nomProf: subject.teacher,
        interrogation: (Number(date.replaceAll('-', '')) + index) % 7 === 0,
        aFaire: {
          idDevoir: Number(date.replaceAll('-', '')) * 10 + index,
          contenu: base64Encode(`<p>${texte}</p>`),
          donneLe: jourDeClasse(addDays(date, -3)),
          effectue: date < today,
          rendreEnLigne: false,
          ressourceDocuments: [],
        },
      }
    })
}

/**
 * Le résumé du cahier de textes, tel que le service le rend vraiment : il dit **quelles**
 * matières ont du travail, et **pas lequel**.
 *
 * L'énoncé n'arrive qu'avec le détail d'un jour. Le mettre ici rendrait la démonstration plus
 * jolie et l'application fausse : on croirait tenir les énoncés alors qu'en réel l'écran
 * resterait vide.
 */
function studentHomework(today: string) {
  const resume: Record<string, unknown> = {}
  for (let offset = -10; offset <= 21; offset += 1) {
    const date = addDays(today, offset)
    const devoirs = homeworkOn(date, today).map((devoir) => ({
      idDevoir: devoir.idDevoir,
      matiere: devoir.matiere,
      codeMatiere: devoir.codeMatiere,
      nomProf: devoir.nomProf,
      interrogation: devoir.interrogation,
      aFaire: true,
      documentsAFaire: false,
      donneLe: devoir.aFaire.donneLe,
      effectue: devoir.aFaire.effectue,
      rendreEnLigne: devoir.aFaire.rendreEnLigne,
    }))
    if (devoirs.length > 0) resume[date] = devoirs
  }
  return resume
}

function studentDay(date: string, today: string) {
  return {
    date,
    matieres: lessonsOfDay(date).map((slot, index) => {
      const subject = subjectOf(slot.code)
      const devoirs = homeworkOn(date, today)
      const mien = devoirs.find((devoir) => devoir.codeMatiere === subject.code)
      const entry: Record<string, unknown> = { id: `${date}-${slot.code}`, matiere: subject.label, codeMatiere: subject.code }
      if (mien) entry['aFaire'] = mien.aFaire
      if (date <= today) {
        entry['contenuDeSeance'] = {
          idDevoir: Number(date.replaceAll('-', '')) * 100 + index,
          contenu: base64Encode(`<p>Cours, exemples au tableau, puis exercices d’application.</p>`),
          documents: [],
        }
      }
      return entry
    }),
  }
}

// ——————————————————————————————————————————— vie scolaire et modules

function studentSchoolLife(today: string) {
  return {
    absencesRetards: [
      {
        id: 7101,
        typeElement: 'Absence',
        libelle: 'Absence',
        date: `${addDays(today, -12)} 08:00`,
        dateFin: `${addDays(today, -12)} 10:00`,
        justifie: true,
        motif: 'Rendez-vous médical',
        commentaire: '',
        displayDate: '2 h',
      },
      {
        id: 7102,
        typeElement: 'Retard',
        libelle: 'Retard',
        date: `${addDays(today, -5)} 08:05`,
        justifie: false,
        motif: 'Transports',
        commentaire: '',
        displayDate: '10 min',
      },
      {
        id: 7103,
        typeElement: 'Absence',
        libelle: 'Absence',
        date: `${addDays(today, -2)} 14:00`,
        dateFin: `${addDays(today, -2)} 15:55`,
        justifie: false,
        motif: '',
        commentaire: '',
        displayDate: '2 h',
      },
    ],
    sanctionsEncouragements: [
      {
        id: 7201,
        typeElement: 'Encouragement',
        libelle: 'Encouragements du conseil de classe',
        date: addDays(today, -20),
        justifie: true,
        motif: '',
        commentaire: 'Attitude exemplaire en cours.',
      },
    ],
  }
}

function studentDocuments(today: string) {
  return {
    notes: [
      { id: 8801, libelle: 'Bulletin du premier trimestre', date: addDays(today, -30), type: 'PDF' },
    ],
    administratifs: [
      { id: 8802, libelle: 'Règlement intérieur', date: `${schoolYear(today).slice(0, 4)}-09-02`, type: 'PDF' },
      { id: 8803, libelle: 'Autorisation de sortie', date: `${schoolYear(today).slice(0, 4)}-09-05`, type: 'PDF' },
    ],
  }
}

function studentNews(today: string) {
  return {
    actualites: [
      {
        id: 8901,
        titre: 'Portes ouvertes du lycée',
        contenu: base64Encode('<p>Le lycée ouvre ses portes samedi de 9 h à 13 h. Les élèves volontaires sont attendus à 8 h 30 au hall.</p>'),
        date: addDays(today, -3),
        auteur: 'Direction',
      },
      {
        id: 8902,
        titre: 'Fermeture du CDI mercredi',
        contenu: base64Encode('<p>Le CDI sera fermé mercredi après-midi pour inventaire.</p>'),
        date: addDays(today, -8),
        auteur: 'CDI',
      },
    ],
  }
}

const TEXTBOOKS = {
  manuels: [
    { id: 8701, titre: 'Mathématiques 1re', matiere: 'Mathématiques', editeur: 'Éditions du démo', url: 'https://exemple.invalid/maths' },
    { id: 8702, titre: 'Histoire-Géographie 1re', matiere: 'Histoire-Géographie', editeur: 'Éditions du démo', url: 'https://exemple.invalid/hg' },
  ],
}

function studentCloud(today: string) {
  return {
    ressources: [
      {
        id: 8610,
        libelle: 'Mes documents',
        typeRessource: 'folder',
        children: [
          { id: 8601, libelle: 'Exposé SES.odt', type: 'file', date: addDays(today, -6), taille: 48210 },
          { id: 8602, libelle: 'TP physique.pdf', type: 'file', date: addDays(today, -14), taille: 220144 },
        ],
      },
      {
        id: 8611,
        libelle: 'Partagé avec la classe',
        typeRessource: 'folder',
        children: [{ id: 8603, libelle: 'Fiche de révisions.pdf', type: 'file', date: addDays(today, -2), taille: 91002 }],
      },
    ],
  }
}

const STUDENT_MAILBOX: DemoMailbox = {
  me: { id: STUDENT.id, role: 'E', civilite: '', prenom: STUDENT.prenom, particule: '', nom: STUDENT.nom },
  received: [
    {
      id: 9301,
      daysAgo: 0,
      time: '07:50',
      person: { id: 301, role: 'A', civilite: '', prenom: '', nom: 'Vie scolaire', fonctionPersonnel: 'CPE' },
      subject: 'Justificatif d’absence attendu',
      html: '<p>Bonjour,</p><p>Nous attendons un justificatif pour l’absence de mardi après-midi. Merci de le déposer à la vie scolaire.</p><p>La vie scolaire</p>',
      read: false,
    },
    {
      id: 9302,
      daysAgo: 1,
      time: '17:20',
      person: { id: 202, role: 'P', civilite: 'M.', prenom: 'Jean', nom: 'Petit' },
      subject: 'Devoir surveillé de mathématiques',
      html: '<p>Bonjour à tous,</p><p>Le devoir surveillé de vendredi portera sur le second degré et les suites. Calculatrice autorisée.</p><p>M. Petit</p>',
      read: false,
    },
    {
      id: 9303,
      daysAgo: 6,
      time: '11:05',
      person: { id: 305, role: 'A', civilite: '', prenom: '', nom: 'Secrétariat de direction' },
      subject: 'Photos de classe',
      html: '<p>Bonjour,</p><p>Les photos de classe seront prises jeudi matin. Aucune tenue particulière n’est demandée.</p><p>Le secrétariat</p>',
      read: true,
    },
  ],
  sent: [
    {
      id: 9401,
      daysAgo: 2,
      time: '19:40',
      person: { id: 202, role: 'P', civilite: 'M.', prenom: 'Jean', nom: 'Petit' },
      subject: 'Question sur l’exercice 24',
      html: '<p>Bonjour Monsieur,</p><p>Je ne comprends pas la deuxième question de l’exercice 24. Pourrait-on la revoir en classe ?</p><p>Camille Bernard</p>',
      read: true,
    },
  ],
}

/** L'emploi du temps de l'élève, semaine type déroulée sur l'intervalle demandé. */
function studentTimetable(from: string, to: string, today: string) {
  const cours: unknown[] = []
  for (let monday = startOfWeek(from); monday <= to; monday = addDays(monday, 7)) {
    STUDENT_WEEK.forEach((slot, index) => {
      const date = addDays(monday, slot.day)
      if (date < from || date > to) return
      const subject = subjectOf(slot.code)
      cours.push({
        id: slotId(date, index),
        text: subject.label.toUpperCase(),
        matiere: subject.label,
        codeMatiere: subject.code,
        typeCours: 'COURS',
        start_date: `${date} ${slot.start}`,
        end_date: `${date} ${slot.end}`,
        prof: subject.teacher,
        salle: subject.room,
        classe: STUDENT.classe,
        // Un cours annulé dans la semaine en cours : il doit rester affiché, barré.
        isAnnule: index === 8 && startOfWeek(date) === startOfWeek(today),
        // Un devoir surveillé annoncé à l'emploi du temps, la semaine prochaine.
        isDevoir: index === 5 && startOfWeek(date) === addDays(startOfWeek(today), 7),
      })
    })
  }
  return cours
}

/** La réponse à une route élève, ou `undefined` quand la démo ne la connaît pas. */
function studentAnswer(path: string, url: URL, body: Record<string, unknown>, today: string): unknown {
  if (/^\/E\/\d+\/emploidutemps\.awp$/i.test(path)) {
    const from = typeof body['dateDebut'] === 'string' ? body['dateDebut'] : startOfWeek(today)
    const to = typeof body['dateFin'] === 'string' ? body['dateFin'] : addDays(from, 6)
    return studentTimetable(from, to, today)
  }

  if (/^\/Eleves\/\d+\/cahierdetexte\.awp$/i.test(path)) return studentHomework(today)

  const jour = /^\/Eleves\/\d+\/cahierdetexte\/(\d{4}-\d{2}-\d{2})\.awp$/i.exec(path)
  if (jour) return studentDay(jour[1] as string, today)

  if (/^\/eleves\/\d+\/notes\.awp$/i.test(path)) return studentGrades(today)
  if (/^\/eleves\/\d+\/viescolaire\.awp$/i.test(path)) return studentSchoolLife(today)
  if (path === '/elevesDocuments.awp') return studentDocuments(today)
  if (/^\/E\/\d+\/viedeletablissement\.awp$/i.test(path)) return studentNews(today)
  if (/^\/E\/\d+\/manuelsnumeriques\.awp$/i.test(path)) return TEXTBOOKS
  if (/^\/(eleves|familles)\/\d+\/cloud\.awp$/i.test(path)) return studentCloud(today)

  if (/^\/(eleves|familles)\/\d+\/messages\.awp$/i.test(path)) {
    return messages(
      url.searchParams.get('typeRecuperation') ?? 'received',
      Number(url.searchParams.get('page') ?? '0') || 0,
      today,
      STUDENT_MAILBOX,
    )
  }

  const detail = /^\/(eleves|familles)\/\d+\/messages\/(\d+)\.awp$/i.exec(path)
  if (detail) {
    const envoye = url.searchParams.get('mode') === 'expediteur'
    const source = envoye ? STUDENT_MAILBOX.sent : STUDENT_MAILBOX.received
    const entry = source.find((message) => String(message.id) === detail[2])
    return entry ? messageFor(entry, envoye ? 'sent' : 'received', today, STUDENT_MAILBOX) : undefined
  }

  return undefined
}

// ————————————————————————————————————————————————————————— le faux serveur

function bodyOf(request: HttpRequest): Record<string, unknown> {
  const raw = request.body ?? ''
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw.startsWith('data=') ? raw.slice('data='.length) : raw))
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/** La réponse à une route enseignant, ou `undefined` quand la démo ne la connaît pas. */
function answer(request: HttpRequest, today: string): unknown {
  const url = new URL(request.url)
  const path = url.pathname.replace(/^\/v3/, '')
  const body = bodyOf(request)

  const eleve = studentAnswer(path, url, body, today)
  if (eleve !== undefined) return eleve

  if (/^\/P\/\d+\/emploidutemps\.awp$/.test(path)) {
    const from = typeof body['dateDebut'] === 'string' ? body['dateDebut'] : startOfWeek(today)
    const to = typeof body['dateFin'] === 'string' ? body['dateFin'] : addDays(from, 6)
    return timetable(from, to, today)
  }

  if (path === '/niveauxListe.awp') return catalog(today)

  const roster = /^\/(classes|groupes)\/(\d+)\/eleves\.awp$/.exec(path)
  if (roster) {
    const kind = roster[1] === 'classes' ? 'C' : 'G'
    const group = GROUPS.find((entry) => String(entry.id) === roster[2] && entry.kind === kind)
    return group ? { eleves: pupils(group, today), entity: { id: group.id, type: group.kind, code: group.code, libelle: group.label } } : undefined
  }

  const slots = /^\/cahierdetexte\/loadslots\/(\d{4}-\d{2}-\d{2})\/(\d{4}-\d{2}-\d{2})\.awp$/.exec(path)
  if (slots) return lessonSlots(slots[1] as string, slots[2] as string, today)

  const notes = /^\/enseignants\/\d+\/([CG])\/(\d+)\/periodes\/([^/]+)\/matieres\/[^/]+\/notes\.awp$/.exec(path)
  if (notes) {
    const group = GROUPS.find((entry) => entry.kind === notes[1] && String(entry.id) === notes[2])
    return group ? gradebook(group, decodeURIComponent(notes[3] as string), today) : undefined
  }

  if (/^\/enseignants\/\d+\/messages\.awp$/.test(path)) {
    return messages(url.searchParams.get('typeRecuperation') ?? 'received', Number(url.searchParams.get('page') ?? '0') || 0, today)
  }

  const detail = /^\/enseignants\/\d+\/messages\/(\d+)\.awp$/.exec(path)
  if (detail) {
    const sent = url.searchParams.get('mode') === 'expediteur'
    const entry = (sent ? SENT : RECEIVED).find((message) => String(message.id) === detail[1])
    return entry ? messageFor(entry, sent ? 'sent' : 'received', today) : undefined
  }

  return undefined
}

/** Le moteur de la démo : il répond comme ÉcoleDirecte, sans jamais toucher au réseau. */
export function demoEngine(today: string): HttpEngine {
  return {
    async send(request: HttpRequest): Promise<HttpResponse> {
      const data = answer(request, today)
      const body =
        data === undefined
          ? { code: 403, message: 'Cette page n’existe pas dans la démonstration.', token: '', data: null }
          : { code: 200, message: '', token: '', data }
      return { status: 200, headers: {}, body: JSON.stringify(body) }
    },
  }
}
