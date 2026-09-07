/**
 * Les dates, en chaînes ISO et sans fuseau.
 *
 * Tout est calculé en UTC volontairement : les dates manipulées ici sont des dates de
 * calendrier scolaire (`2026-09-07`), pas des instants. Les interpréter dans le fuseau du
 * serveur décalerait l'emploi du temps d'un jour pour qui se connecte à 23 h, et d'une heure
 * deux fois par an.
 */

const DAY_MS = 86_400_000

export const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
export const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]
export const SHORT_MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

export function dateOf(value: string): string {
  return value.slice(0, 10)
}

export function timeOf(value: string): string {
  return value.length >= 16 ? value.slice(11, 16) : ''
}

function toUtc(date: string): number {
  return Date.parse(`${dateOf(date)}T00:00:00Z`)
}

export function addDays(date: string, days: number): string {
  return new Date(toUtc(date) + days * DAY_MS).toISOString().slice(0, 10)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS)
}

/** 0 = dimanche, 1 = lundi… comme `getUTCDay`. */
export function weekday(date: string): number {
  return new Date(toUtc(date)).getUTCDay()
}

/** Le lundi de la semaine, y compris pour un dimanche — qui appartient à la semaine écoulée. */
export function startOfWeek(date: string): string {
  const day = weekday(date)
  return addDays(date, day === 0 ? -6 : 1 - day)
}

/** Lundi à samedi : un établissement peut avoir cours le samedi matin, pas le dimanche. */
export function isSchoolDay(date: string): boolean {
  const day = weekday(date)
  return day >= 1 && day <= 6
}

export function nextSchoolDay(date: string): string {
  let candidate = addDays(date, 1)
  while (!isSchoolDay(candidate)) candidate = addDays(candidate, 1)
  return candidate
}

export function previousSchoolDay(date: string): string {
  let candidate = addDays(date, -1)
  while (!isSchoolDay(candidate)) candidate = addDays(candidate, -1)
  return candidate
}

export function dayName(date: string): string {
  return WEEKDAYS[weekday(date)] as string
}

export function longDate(date: string): string {
  const [year, month, day] = dateOf(date).split('-')
  return `${dayName(date)} ${Number(day)} ${MONTHS[Number(month) - 1] as string} ${year}`
}

export function shortDate(date: string): string {
  const [, month, day] = dateOf(date).split('-')
  return `${Number(day)} ${SHORT_MONTHS[Number(month) - 1] as string}`
}

/** « aujourd'hui », « demain », « hier », sinon la date. Ce qu'on dirait à voix haute. */
export function relativeDay(date: string, today: string): string {
  switch (daysBetween(today, date)) {
    case 0:
      return "aujourd'hui"
    case 1:
      return 'demain'
    case -1:
      return 'hier'
    case 2:
      return 'après-demain'
    default:
      return longDate(date)
  }
}

/**
 * L'horodatage d'une liste : l'heure pour aujourd'hui, la date sinon.
 *
 * « aujourd'hui » ne distingue pas un message de 8 h d'un message reçu il y a deux minutes.
 */
export function listStamp(value: string, today: string): string {
  const date = dateOf(value)
  if (date === today) return timeOf(value) || shortDate(date)
  if (daysBetween(today, date) === -1) return 'hier'
  return shortDate(date)
}

/** Une durée en minutes, dite comme on la dit : « 1 h 30 », « 45 min ». */
export function duration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`
}

export function minutesBetween(start: string, end: string): number {
  return Math.max(0, Math.round((Date.parse(`${end}Z`) - Date.parse(`${start}Z`)) / 60_000))
}

/** « dans 24 min », « il y a 3 h » — la précision qu'un compte à rebours mérite. */
export function relativeTime(target: string, now: string): string {
  const minutes = Math.round((Date.parse(`${target}Z`) - Date.parse(`${now}Z`)) / 60_000)
  const magnitude = Math.abs(minutes)
  const value = magnitude < 60 ? `${magnitude} min` : duration(magnitude)
  return minutes >= 0 ? `dans ${value}` : `il y a ${value}`
}
