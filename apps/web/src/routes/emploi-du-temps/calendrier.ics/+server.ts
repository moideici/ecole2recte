import type { RequestHandler } from './$types'
import { error } from '@sveltejs/kit'
import { calendarIcs, lessonUid, readAlternance } from '$lib/exportsEdt.js'
import { exportLessons } from '$lib/server/exportsEdt.js'

export const GET: RequestHandler = async ({ locals, url, cookies }) => {
  const { lessons, profile } = await exportLessons(locals, url, 14)
  const event = url.searchParams.get('evenement')
  const selected = event ? (await Promise.all(lessons.map(async (lesson) => ({ lesson, uid: await lessonUid(profile, lesson) })))).filter((entry) => entry.uid === event).map((entry) => entry.lesson) : lessons
  if (event && (selected.length !== 1 || selected[0]?.canceled)) error(404, 'Cours introuvable.')
  return new Response(await calendarIcs(selected, profile, readAlternance(cookies.get('e2r-alternance'))), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'attachment; filename="emploi-du-temps.ics"', 'Cache-Control': 'private, no-store' },
  })
}
