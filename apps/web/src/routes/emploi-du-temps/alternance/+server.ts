import type { RequestHandler } from './$types'
import { redirect, error } from '@sveltejs/kit'
import { requireStudent } from '$lib/server/guard.js'
import { today } from '$lib/server/api.js'
import { startOfWeek } from '@ecole2recte/protocol'
import { validDate } from '$lib/exportsEdt.js'

export const POST: RequestHandler = async ({ locals, request, cookies, url }) => {
  requireStudent(locals)
  const form = await request.formData()
  const label = form.get('semaine')
  if (label !== 'A' && label !== 'B' && label !== '') error(400, 'Semaine invalide.')
  if (label) cookies.set('e2r-alternance', `${startOfWeek(today())}:${label}`, { path: '/', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:', maxAge: 31536000 })
  else cookies.delete('e2r-alternance', { path: '/' })
  const day = form.get('jour')
  redirect(303, `/emploi-du-temps${typeof day === 'string' && validDate(day) ? `?jour=${day}` : ''}`)
}
