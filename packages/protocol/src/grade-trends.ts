import type { Grade, SubjectAverage } from './models.js'
import { isSubSubject } from './models.js'
import { gradesFor, weightedAverage, type AverageOrigin } from './insights.js'

export interface AveragePoint { date: string; value: number }

/** L'historique du bulletin n'est pas fourni : on reconstruit uniquement les calculs connus. */
export function averageSeries(grades: Grade[], period: string, subjects: SubjectAverage[], subject?: string): AveragePoint[] {
  const dated = gradesFor(grades, period, subject).filter((grade) => grade.date !== undefined)
  const dates = [...new Set(dated.map((grade) => grade.date as string))].sort()
  return dates.flatMap((date) => {
    const partial = dated.filter((grade) => (grade.date as string) <= date)
    let value = weightedAverage(partial)
    if (subject === undefined) {
      let total = 0
      let weight = 0
      for (const name of new Set(partial.map((grade) => grade.subject))) {
        const metadata = subjects.find((entry) => entry.periodCode === period && entry.subject === name)
        if (metadata && isSubSubject(metadata)) continue
        const mean = weightedAverage(partial.filter((grade) => grade.subject === name))
        if (mean === undefined) continue
        const coefficient = (metadata?.coefficient ?? 1) > 0 ? (metadata?.coefficient ?? 1) : 1
        total += mean * coefficient
        weight += coefficient
      }
      value = weight > 0 ? total / weight : undefined
    }
    return value === undefined ? [] : [{ date, value }]
  })
}

/** L'écart reste sur le barème du devoir, comme la moyenne de classe fournie. */
export function classDelta(grade: Grade): number | undefined {
  return grade.value === undefined || grade.classAverage === undefined ? undefined : grade.value - grade.classAverage
}

/** Trois jours calendaires, jour de saisie compris ; sans saisie, la date du devoir sert de repli. */
export function isNewGrade(grade: Grade, today: string): boolean {
  const date = grade.enteredOn ?? grade.date
  if (!date) return false
  const days = (Date.parse(today) - Date.parse(date)) / 86_400_000
  return Number.isFinite(days) && days >= 0 && days < 3
}

export function averageLabel(origin: AverageOrigin): string {
  return origin === 'official' ? 'Officielle' : origin === 'none' ? 'Indisponible' : 'Calculée par l’appli'
}
