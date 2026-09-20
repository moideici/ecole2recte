import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { accountRole, displayName, isStudent } from '@ecole2recte/protocol'
import { requireAccount } from '$lib/server/guard.js'

export const load: PageServerLoad = ({ locals }) => {
  const { account } = requireAccount(locals)
  // Un élève et un enseignant ont chacun leur espace : cette page n'explique qu'une absence
  // de support.
  if (isStudent(account)) redirect(303, '/')
  if (accountRole(account) === 'teacher') redirect(303, '/prof')
  return {
    nom: displayName(account),
    type: account.type,
    modules: account.modules.filter((module) => module.enabled).map((module) => module.code),
  }
}
