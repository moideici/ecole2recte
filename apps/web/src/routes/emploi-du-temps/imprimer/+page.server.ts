import type { PageServerLoad } from './$types'
import { exportLessons } from '$lib/server/exportsEdt.js'
import { readAlternance, weekLabel } from '$lib/exportsEdt.js'
import { addDays } from '@ecole2recte/protocol'
export const load: PageServerLoad = async ({ locals, url, cookies, setHeaders }) => {
  const { week, lessons } = await exportLessons(locals, url, 7)
  setHeaders({ 'Cache-Control': 'private, no-store' })
  return { week, label: weekLabel(week, readAlternance(cookies.get('e2r-alternance'))), days: Array.from({ length: 6 }, (_, index) => ({ date: addDays(week, index), lessons: lessons.filter((lesson) => lesson.start.startsWith(addDays(week, index)) && !lesson.canceled) })) }
}
