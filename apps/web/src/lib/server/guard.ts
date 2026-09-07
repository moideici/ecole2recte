import { redirect } from '@sveltejs/kit'
import { type Account, accountRole, isStudent } from '@ecole2recte/protocol'
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

/**
 * Les pages de données exigent un profil élève.
 *
 * Un compte parent en fournit un par enfant, donc il passe. Un compte enseignant, non : ses
 * routes vivent sur un autre hôte et ne sont documentées qu'en lecture, par une seule
 * source. Lui servir les écrans élève ne produirait qu'une suite d'« accès refusé » sans
 * explication. Mieux vaut une page qui dit exactement où l'on en est.
 */
export function requireStudent(locals: App.Locals): Guarded {
  const guarded = requireAccount(locals)
  if (!isStudent(guarded.account)) redirect(303, '/profil')
  return guarded
}

export function roleOf(locals: App.Locals): string {
  const record = locals.session
  const account = record ? activeAccount(record) : null
  return account ? accountRole(account) : 'unknown'
}
