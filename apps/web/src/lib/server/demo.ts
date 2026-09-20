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
 * Il sert à montrer l'espace professeur à qui n'a pas encore branché son compte, et à le
 * tester sans en avoir.
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
    date: addDays(period.dateDebut, Math.round(((index + 1) * span) / (count + 1))),
  }))
  const next = current ? PLAN[count] : undefined
  if (next) planned.push({ ...next, date: addDays(today, 5) })

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

function messageFor(entry: DemoMessage, folder: string, today: string) {
  const person = { particule: '', fonctionPersonnel: '', ...entry.person, to_cc_cci: 'to', read: true }
  const me = { ...ME, fonctionPersonnel: '', to_cc_cci: 'to', read: entry.read }
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

function messages(folder: string, page: number, today: string) {
  const source = folder === 'received' ? RECEIVED : folder === 'sent' ? SENT : []
  const list = page > 0 ? [] : source.map((entry) => messageFor(entry, folder, today))
  return {
    classeurs: [],
    pagination: {
      messagesRecusCount: RECEIVED.length,
      messagesEnvoyesCount: SENT.length,
      messagesArchivesCount: 0,
      messagesRecusNotReadCount: RECEIVED.filter((entry) => !entry.read).length,
      messagesDraftCount: 0,
    },
    messages: { received: [], sent: [], archived: [], draft: [], [folder]: list },
  }
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
