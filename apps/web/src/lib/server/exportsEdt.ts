import { error } from '@sveltejs/kit'
import { addDays, startOfWeek } from '@ecole2recte/protocol'
import { cached, clientFor, today } from './api.js'
import { requireStudent } from './guard.js'
import { validDate } from '$lib/exportsEdt.js'

export async function exportLessons(locals: App.Locals, url: URL, days: number) {
  const { id, record, account } = requireStudent(locals)
  const requested = url.searchParams.get('jour')
  if (requested !== null && !validDate(requested)) error(400, 'Date invalide.')
  const week = startOfWeek(requested ?? today())
  const { api } = clientFor(record, id)
  const result = await cached(id, record, `export-edt:${account.id}:${week}:${days}`, () => api.timetable(account, week, addDays(week, days - 1)))
  if (!result.ok) error(502, 'L’emploi du temps n’a pas pu être chargé.')
  return { week, profile: account.id, lessons: result.value.filter((lesson) => lesson.start.slice(0, 10) >= week && lesson.start.slice(0, 10) < addDays(week, days)) }
}
