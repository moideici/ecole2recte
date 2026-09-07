import type { Grade, Period, Skill, SubjectAverage } from '../models.js'
import {
  type Json,
  asObject,
  objects,
  personName,
  pickBool,
  pickDate,
  pickNumber,
  pickText,
  text,
} from './json.js'

export interface GradesPayload {
  periods: Period[]
  grades: Grade[]
  subjectAverages: SubjectAverage[]
}

/**
 * Le bulletin.
 *
 * Trois précautions qui changent tout. Une note peut ne **pas compter** (`nonSignificatif`) :
 * l'inclure fausse la moyenne et rend l'application menteuse. Une note peut n'avoir **pas de
 * valeur** (« Abs », devoir non rendu) : la lire comme zéro serait une accusation. Et la
 * moyenne générale de l'établissement, quand elle existe, prime sur celle qu'on calculerait —
 * les coefficients réels ne sont pas tous exposés.
 */
export function parseGrades(data: unknown): GradesPayload {
  const root = asObject(data)
  if (!root) return { periods: [], grades: [], subjectAverages: [] }

  const periods: Period[] = []
  const subjectAverages: SubjectAverage[] = []

  for (const raw of objects(root['periodes'])) {
    const code = pickText(raw, 'idPeriode', 'codePeriode', 'code')
    if (code === '') continue
    const set = asObject(raw['ensembleMatieres'])
    const period: Period = {
      code,
      name: pickText(raw, 'periode', 'libelle') || code,
      current: pickBool(raw, ['cloture'], false) === false && pickBool(raw, ['isCurrent', 'courante'], false),
      appreciation: pickText(set ?? {}, 'appreciationPP', 'appreciationGenerale'),
      headTeacher: pickText(set ?? {}, 'nomPP', 'professeurPrincipal'),
      councilTime: pickText(set ?? {}, 'heureConseil'),
    }
    const average = pickNumber(raw, 'moyenneGenerale')
    if (average !== undefined) period.average = average
    const classAverage = pickNumber(raw, 'moyenneClasse')
    if (classAverage !== undefined) period.classAverage = classAverage
    const start = pickDate(raw, 'dateDebut')
    if (start) period.start = start
    const end = pickDate(raw, 'dateFin')
    if (end) period.end = end
    const councilDate = set ? pickDate(set, 'dateConseil') : undefined
    if (councilDate) period.councilDate = councilDate
    const min = pickNumber(raw, 'moyenneMin')
    if (min !== undefined) period.minimum = min
    const max = pickNumber(raw, 'moyenneMax')
    if (max !== undefined) period.maximum = max
    periods.push(period)

    for (const discipline of objects(set?.['disciplines'])) {
      const subject = pickText(discipline, 'discipline', 'libelle', 'codeMatiere')
      if (subject === '') continue
      const teachers = objects(discipline['professeurs']).map((teacher) => personName(teacher)).filter((name) => name !== '')
      const entry: SubjectAverage = {
        periodCode: code,
        subject,
        teacher: teachers[0] ?? pickText(discipline, 'professeur'),
        teachers,
        appreciation: appreciationOf(discipline),
        // Une sous-matière (une spécialité sous son tronc commun) se range sous sa mère.
        parentSubject: pickText(discipline, 'codeSousMatiere') !== '' ? pickText(discipline, 'discipline') : '',
      }
      const value = pickNumber(discipline, 'moyenne')
      if (value !== undefined) entry.average = value
      const classValue = pickNumber(discipline, 'moyenneClasse')
      if (classValue !== undefined) entry.classAverage = classValue
      const coefficient = pickNumber(discipline, 'coef')
      if (coefficient !== undefined) entry.coefficient = coefficient
      const min = pickNumber(discipline, 'moyenneMin')
      if (min !== undefined) entry.minimum = min
      const max = pickNumber(discipline, 'moyenneMax')
      if (max !== undefined) entry.maximum = max
      subjectAverages.push(entry)
    }
  }

  const grades: Grade[] = []
  for (const raw of objects(root['notes'])) {
    const id = pickText(raw, 'id')
    if (id === '') continue
    const grade: Grade = {
      id,
      subject: pickText(raw, 'libelleMatiere', 'matiere', 'codeMatiere'),
      label: pickText(raw, 'devoir', 'libelle'),
      scale: pickNumber(raw, 'noteSur') ?? 20,
      coefficient: pickNumber(raw, 'coef') ?? 1,
      periodCode: pickText(raw, 'codePeriode', 'idPeriode'),
      // `nonSignificatif` dit que la note ne compte pas : l'ignorer rend la moyenne fausse.
      counted: !pickBool(raw, ['nonSignificatif']),
      comment: pickText(raw, 'commentaire', 'elementsProgrammeCommentaire'),
      kind: pickText(raw, 'typeDevoir'),
      skills: parseSkills(raw['elementsProgramme']),
    }
    // Une note absente n'est pas un zéro : « Abs » ou un devoir non rendu n'a pas de valeur.
    const value = pickNumber(raw, 'valeur')
    if (value !== undefined) grade.value = value
    const classAverage = pickNumber(raw, 'moyenneClasse')
    if (classAverage !== undefined) grade.classAverage = classAverage
    const date = pickDate(raw, 'date', 'dateSaisie')
    if (date) grade.date = date
    const min = pickNumber(raw, 'minClasse')
    if (min !== undefined) grade.minimum = min
    const max = pickNumber(raw, 'maxClasse')
    if (max !== undefined) grade.maximum = max
    grades.push(grade)
  }

  grades.sort((left, right) => (right.date ?? '').localeCompare(left.date ?? ''))
  return { periods, grades, subjectAverages }
}

/** Plusieurs professeurs se partagent parfois une matière, et chacun écrit la sienne. */
function appreciationOf(discipline: Json): string {
  const list = objects(discipline['appreciations'])
    .map((entry) => pickText(entry, 'appreciation', 'commentaire'))
    .filter((entry) => entry !== '')
  if (list.length > 0) return list.join('\n\n')
  const flat = discipline['appreciations']
  if (Array.isArray(flat)) {
    const strings = flat.filter((entry): entry is string => typeof entry === 'string' && entry !== '')
    if (strings.length > 0) return strings.join('\n\n')
  }
  return text(discipline['appreciation'])
}

function parseSkills(value: unknown): Skill[] {
  const skills: Skill[] = []
  for (const raw of objects(value)) {
    const label = pickText(raw, 'libelleCompetence', 'descriptif', 'libelle')
    if (label === '') continue
    const skill: Skill = { label, level: pickText(raw, 'valeur', 'niveau') }
    const numeric = pickNumber(raw, 'valeur')
    if (numeric !== undefined) skill.value = numeric
    skills.push(skill)
  }
  return skills
}
