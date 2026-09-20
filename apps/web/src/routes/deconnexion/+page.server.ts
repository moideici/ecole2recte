import { redirect } from '@sveltejs/kit'
import type { Actions } from './$types'
import { clearSessionCookie } from '$lib/server/session.js'
import { sessions } from '$lib/server/store.js'

/** Se déconnecter efface la session côté serveur, pas seulement le cookie côté navigateur. */
export const actions: Actions = {
  default: async ({ cookies, locals }) => {
    if (locals.sessionId) await sessions.destroy(locals.sessionId)
    clearSessionCookie(cookies)
    redirect(303, '/connexion')
  },
}
