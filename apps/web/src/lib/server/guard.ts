import { redirect } from '@sveltejs/kit'
import type { Account } from '@ecole2recte/protocol'
import { activeAccount } from './session.js'
import type { SessionRecord } from './store.js'

export interface Guarded {
  id: string
  record: SessionRecord
  account: Account
}

/**
 * Toute page de données passe par ici.
 *
 * Une session absente ou sans profil lisible renvoie à la connexion : c'est plus honnête
 * qu'un écran vide qu'on prendrait pour une panne.
 */
export function requireAccount(locals: App.Locals): Guarded {
  const id = locals.sessionId
  const record = locals.session
  if (!id || !record) redirect(303, '/connexion')
  const account = activeAccount(record)
  if (!account) redirect(303, '/connexion')
  return { id, record, account }
}
