import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { accountRole, displayName, isStudent } from '@ecole2recte/protocol'
import { requireAccount } from '$lib/server/guard.js'

export const load: PageServerLoad = ({ locals }) => {
  const { account } = requireAccount(locals)
  // Un profil élève n'a rien à faire ici : cette page explique une absence de support.
  if (isStudent(account)) redirect(303, '/')
  return {
    role: accountRole(account),
    nom: displayName(account),
    type: account.type,
    modules: account.modules.filter((module) => module.enabled).map((module) => module.code),
  }
}
