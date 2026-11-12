import { redirect } from '@sveltejs/kit'
import type { Actions } from './$types'
import { clearSessionCookie } from '$lib/server/session.js'
import { oublierAppareil } from '$lib/server/appareil.js'
import { sessions } from '$lib/server/store.js'

/** Se déconnecter efface la session côté serveur, pas seulement le cookie côté navigateur. */
export const actions: Actions = {
  default: async ({ cookies, locals }) => {
    if (locals.sessionId) await sessions.destroy(locals.sessionId)
    // Se déconnecter oublie aussi l'appareil : plus d'identifiants gardés, plus de réouverture.
    await oublierAppareil(cookies)
    clearSessionCookie(cookies)
    redirect(303, '/connexion')
  },
}
