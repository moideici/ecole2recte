import { describe, expect, it } from 'vitest'
import { EcoleDirecteClient } from '../src/client.js'
import { type Account, accountRole } from '../src/models.js'
import { parseAccounts } from '../src/parse/accounts.js'
import { parseCatalog, parseGradebook, parseLessonSlots, parsePupils } from '../src/parse/teacher.js'
import { TeacherApi, subjectSegment } from '../src/teacher.js'
import {
  assessmentStats,
  groupAverage,
  groupKey,
  parseGroupKey,
  pupilAverage,
  schoolYear,
} from '../src/teaching.js'
import { FakeEngine } from './fake.js'
import { CATALOG, GRADEBOOK, LESSON_SLOTS, PUPILS, TEACHER_LOGIN } from './teacherFixtures.js'

const PROF = parseAccounts(TEACHER_LOGIN)[0] as Account

function api(): { api: TeacherApi; engine: FakeEngine } {
  const engine = new FakeEngine([{ match: '', body: { code: 200, data: null } }])
  // La police reste fermée : aucune lecture enseignant ne doit dépendre d'elle.
  const client = new EcoleDirecteClient({ engine, writePolicy: 'deny' })
  client.session.token = 'JETON'
  client.session.twoFactorToken = 'JETON-2FA'
  return { api: new TeacherApi(client), engine }
}

describe('compte enseignant', () => {
  it('reconnaît le type P et garde classes, groupes et matières du login', () => {
    expect(accountRole(PROF)).toBe('teacher')
    expect(PROF.id).toBe('5517')
    expect(PROF.className).toBe('')
    expect(PROF.teacher?.classes).toEqual([{ kind: 'C', id: '812', code: '2GT3', label: 'Seconde 3' }])
    // Le login les appelle `groupesNiveau`.
    expect(PROF.teacher?.groups[0]).toMatchObject({ kind: 'G', id: '901', label: 'Spé maths 1re' })
    expect(PROF.teacher?.subjects).toEqual([{ code: 'MATHS', label: 'Mathématiques' }])
    expect(PROF.modules.find((module) => module.code === 'APPEL')?.enabled).toBe(false)
  })
})

describe('ce que l’on envoie', () => {
  it('vise l’hôte enseignant pour l’emploi du temps, avec les jetons', async () => {
    const { api: subject, engine } = api()
    await subject.timetable(PROF, '2026-09-14', '2026-09-20')
    const request = engine.requests[0]
    expect(request?.url).toBe('https://apip.ecoledirecte.com/v3/P/5517/emploidutemps.awp?verbe=get&v=4.101.4')
    expect(engine.sentBody(0)).toEqual({ dateDebut: '2026-09-14', dateFin: '2026-09-20', avecTrous: false })
    expect(request?.headers['X-Token']).toBe('JETON')
    expect(request?.headers['2FA-Token']).toBe('JETON-2FA')
  })

  it('demande le catalogue avec un corps vide', async () => {
    const { api: subject, engine } = api()
    await subject.catalog(PROF)
    expect(engine.requests[0]?.url).toBe('https://apip.ecoledirecte.com/v3/niveauxListe.awp?verbe=get&v=4.101.4')
    expect(engine.sentBody(0)).toEqual({})
  })

  it('distingue la liste d’une classe de celle d’un groupe', async () => {
    const { api: subject, engine } = api()
    await subject.pupils({ kind: 'C', id: '812' })
    await subject.pupils({ kind: 'G', id: '901' })
    expect(engine.requests[0]?.url).toBe('https://apip.ecoledirecte.com/v3/classes/812/eleves.awp?verbe=get&v=4.101.4')
    expect(engine.requests[1]?.url).toBe('https://apip.ecoledirecte.com/v3/groupes/901/eleves.awp?verbe=get&v=4.101.4')
  })

  it('met les dates du cahier de textes dans le chemin', async () => {
    const { api: subject, engine } = api()
    await subject.lessonSlots('2026-09-14', '2026-09-20')
    expect(engine.requests[0]?.url).toBe(
      'https://apip.ecoledirecte.com/v3/cahierdetexte/loadslots/2026-09-14/2026-09-20.awp?verbe=get&v=4.101.4',
    )
  })

  it('refuse une période de cahier de textes à l’envers sans rien envoyer', async () => {
    const { api: subject, engine } = api()
    const result = await subject.lessonSlots('2026-09-20', '2026-09-14')
    expect(result.ok).toBe(false)
    expect(engine.requests).toHaveLength(0)
  })

  it('construit la route de notes avec le séparateur ¤ encodé', async () => {
    const { api: subject, engine } = api()
    await subject.gradebook(PROF, { kind: 'C', id: '812' }, 'A001', 'MATHS')
    expect(engine.requests[0]?.url).toBe(
      'https://apip.ecoledirecte.com/v3/enseignants/5517/C/812/periodes/A001/matieres/MATHS%C2%A4/notes.awp?verbe=get&v=4.101.4',
    )
  })

  it('garde un code matière qui porte déjà sa sous-matière', () => {
    expect(subjectSegment('FRANC', 'ORAL')).toBe('FRANC%C2%A4ORAL')
    expect(subjectSegment(' FRANC¤ECRIT ')).toBe('FRANC%C2%A4ECRIT')
  })

  it('lit la messagerie enseignant avec les paramètres du site', async () => {
    const { api: subject, engine } = api()
    await subject.messages(PROF, { folder: 'received' })
    expect(engine.requests[0]?.url).toBe(
      'https://apip.ecoledirecte.com/v3/enseignants/5517/messages.awp?verbe=get&force=false&typeRecuperation=received&idClasseur=0&orderBy=date&order=desc&query=&onlyRead=&page=0&itemsPerPage=50&getAll=0&v=4.101.4',
    )
  })

  it('ouvre un message avec le bon côté et l’année scolaire en cours', async () => {
    const { api: subject, engine } = api()
    await subject.messageDetail(PROF, '77', 'sent', '2026-09-14')
    expect(engine.requests[0]?.url).toBe(
      'https://apip.ecoledirecte.com/v3/enseignants/5517/messages/77.awp?verbe=get&mode=expediteur&v=4.101.4',
    )
    expect(engine.sentBody(0)).toEqual({ anneeMessages: '2026-2027' })
  })
})

describe('emploi du temps enseignant', () => {
  it('met la classe à la place du groupe quand le cours n’en a pas', async () => {
    const engine = new FakeEngine([
      {
        match: 'emploidutemps.awp',
        body: {
          code: 200,
          data: [
            { id: 1, text: 'MATHS', matiere: 'Mathématiques', start_date: '2026-09-14 10:00', end_date: '2026-09-14 10:55', classe: 'Seconde 3', groupe: '', prof: 'MARTIN C.', salle: 'B204' },
            { id: 2, text: 'MATHS', matiere: 'Mathématiques', start_date: '2026-09-14 08:00', end_date: '2026-09-14 08:55', classe: '', groupe: 'Spé maths 1re', salle: 'C011' },
          ],
        },
      },
    ])
    const result = await new TeacherApi(new EcoleDirecteClient({ engine })).timetable(PROF, '2026-09-14', '2026-09-14')
    expect(result.ok && result.value.map((lesson) => lesson.group)).toEqual(['Spé maths 1re', 'Seconde 3'])
  })
})

describe('catalogue', () => {
  const catalog = parseCatalog(CATALOG, { id: PROF.id, profile: PROF.teacher })

  it('retrouve dans le login une classe rendue sans identifiant', () => {
    expect(catalog.groups.map(groupKey)).toEqual(['C-812', 'C-815', 'G-901'])
  })

  it('reconnaît le professeur principal par le tableau qui le nomme', () => {
    expect(catalog.groups.find((group) => group.id === '812')?.headTeacher).toBe(true)
    expect(catalog.groups.find((group) => group.id === '815')?.headTeacher).toBe(false)
  })

  it('ne double pas une période répétée et garde ses matières', () => {
    const periods = catalog.groups.find((group) => group.id === '812')?.periods ?? []
    expect(periods.map((period) => period.code)).toEqual(['A001', 'A002'])
    expect(periods[0]?.subjects).toEqual([{ code: 'MATHS', label: 'Mathématiques', graded: true }])
    expect(periods[0]?.councilDate).toBe('2026-12-03')
    expect(periods[0]?.open).toBe(true)
    expect(periods[1]?.open).toBe(false)
  })

  it('ignore un groupe à la racine sans établissement', () => {
    expect(catalog.groups.some((group) => group.id === '950')).toBe(false)
  })

  it('rassemble la grille d’appel, sans doublon et dans l’ordre', () => {
    expect(catalog.attendanceSlots).toEqual([
      { start: '08:00', end: '08:55' },
      { start: '09:00', end: '09:55' },
    ])
  })

  it('accepte aussi un simple tableau d’établissements', () => {
    expect(parseCatalog(CATALOG.etablissements).schools).toEqual([{ id: '1', code: 'VH', name: 'Lycée Victor Hugo' }])
  })

  it('ne lève pas sur une réponse vide ou biscornue', () => {
    expect(parseCatalog(null).groups).toEqual([])
    expect(parseCatalog({ etablissements: 'non' }).groups).toEqual([])
  })
})

describe('élèves', () => {
  it('trie par nom, lit la classe imbriquée et écarte un élève sans identifiant', () => {
    const pupils = parsePupils(PUPILS)
    expect(pupils.map((pupil) => pupil.lastName)).toEqual(['Aubert', 'Bernard'])
    expect(pupils[0]?.className).toBe('Seconde 3')
    expect(pupils[0]?.dispensed).toBe(true)
    expect(pupils[1]?.supports).toEqual(['PAP'])
    expect(pupils[1]?.birthDate).toBe('2011-02-03')
    // Une date de sortie vide n'est pas une sortie.
    expect(pupils[1]?.leftOn).toBeUndefined()
  })

  it('accepte la liste à plat', () => {
    expect(parsePupils(PUPILS.eleves)).toHaveLength(2)
  })
})

describe('cahier de textes', () => {
  const slots = parseLessonSlots(LESSON_SLOTS)

  it('remet les séances dans l’ordre et écarte celle sans horaire', () => {
    expect(slots.map((slot) => slot.id)).toEqual(['44000', '44001'])
  })

  it('décode le travail à faire en base64 et en retire le balisage', () => {
    const slot = slots.find((entry) => entry.id === '44001')
    expect(slot?.homework?.content).toBe('Exercices 12 à 18\n\nPage 45')
    expect(slot?.homework?.attachments.map((piece) => piece.name)).toEqual(['Consigne.pdf'])
    expect(slot?.homework?.givenOn).toBe('2026-09-14')
    expect(slot?.exam).toBe(true)
    expect(slot?.group).toEqual({ kind: 'C', id: '812', code: '2GT3', label: 'Seconde 3' })
  })

  it('garde tel quel un contenu écrit en clair au lieu de le décoder en charabia', () => {
    expect(slots.find((entry) => entry.id === '44001')?.session?.content).toBe('Test de fin de chapitre')
  })

  it('ne décode pas un mot qui a seulement la forme du base64', () => {
    // « Test » passe pour du base64 ; décodé, il ne donne pas un texte valide.
    const [slot] = parseLessonSlots([
      { idCours: 1, start_date: '2026-09-14 08:00', end_date: '2026-09-14 08:55', seance: { contenu: 'Test' } },
    ])
    expect(slot?.session?.content).toBe('Test')
  })

  it('ne fait pas d’un drapeau ou d’un travail vide une séance', () => {
    const slot = slots.find((entry) => entry.id === '44000')
    expect(slot?.session).toBeUndefined()
    expect(slot?.homework).toBeUndefined()
    expect(slot?.group.kind).toBe('G')
  })
})

describe('grille de notes', () => {
  const gradebook = parseGradebook(GRADEBOOK)

  it('range les évaluations par date', () => {
    expect(gradebook.assessments.map((assessment) => assessment.id)).toEqual(['72', '71', '73'])
    expect(gradebook.assessments.find((assessment) => assessment.id === '71')?.kind).toBe('Devoir surveillé')
    // `typeDevoir: {}` veut dire « pas de type ».
    expect(gradebook.assessments.find((assessment) => assessment.id === '72')?.kind).toBe('')
    expect(gradebook.assessments.find((assessment) => assessment.id === '73')?.counted).toBe(false)
  })

  it('garde la note telle qu’écrite et n’en tire une valeur que si elle est numérique', () => {
    const lea = gradebook.rows.find((row) => row.pupil.id === '3001')
    const adam = gradebook.rows.find((row) => row.pupil.id === '3002')
    expect(lea?.marks['71']).toEqual({ raw: '15,5', value: 15.5, comment: '' })
    // Une absence n'est pas un zéro.
    expect(adam?.marks['71']).toEqual({ raw: 'Abs', comment: '' })
    expect(adam?.marks['72']?.comment).toBe('Rattrapage')
  })

  it('désigne par sa clé une note qui ne rappelle pas son évaluation', () => {
    expect(gradebook.rows.find((row) => row.pupil.id === '3001')?.marks['73']?.value).toBe(2)
  })

  it('calcule une moyenne sur 20 avec barèmes et coefficients, sans l’évaluation non significative', () => {
    // Léa : 15,5/20 × 2 et 8/10 → 16/20 × 1 ; le « Test blanc » ne compte pas.
    expect(pupilAverage(gradebook, '3001')).toBeCloseTo(47 / 3, 6)
    // Adam : absent au DS, 5/10 → 10/20.
    expect(pupilAverage(gradebook, '3002')).toBe(10)
    expect(groupAverage(gradebook)).toBeCloseTo((47 / 3 + 10) / 2, 6)
    expect(pupilAverage(gradebook, 'inconnu')).toBeUndefined()
  })

  it('résume une évaluation sur son propre barème', () => {
    expect(assessmentStats(gradebook, '72')).toEqual({ count: 2, average: 6.5, minimum: 5, maximum: 8 })
    expect(assessmentStats(gradebook, '999')).toEqual({ count: 0 })
  })

  it('ne lève pas sur une réponse vide', () => {
    expect(parseGradebook(null)).toEqual({ assessments: [], rows: [] })
    expect(parseGradebook({ devoirs: 'non', eleves: [{ eleve: {} }] })).toEqual({ assessments: [], rows: [] })
  })
})

describe('outils', () => {
  it('bascule l’année scolaire en août', () => {
    expect(schoolYear('2026-09-14')).toBe('2026-2027')
    expect(schoolYear('2026-08-01')).toBe('2026-2027')
    expect(schoolYear('2026-07-31')).toBe('2025-2026')
  })

  it('fait l’aller-retour d’une clé de classe et refuse le reste', () => {
    expect(parseGroupKey(groupKey({ kind: 'G', id: '901' }))).toEqual({ kind: 'G', id: '901' })
    expect(parseGroupKey('X-1')).toBeNull()
    expect(parseGroupKey('C-../../x')).toBeNull()
  })
})
