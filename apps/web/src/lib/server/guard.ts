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
 * Les pages élève exigent un profil élève.
 *
 * Un compte parent en fournit un par enfant, donc il passe. Un enseignant a son propre
 * espace : ses routes vivent sur un autre hôte, et lui servir les écrans élève ne produirait
 * qu'une suite d'« accès refusé ». Tout autre profil arrive sur une page qui dit pourquoi
 * l'application ne sait pas quoi lui montrer.
 */
export function requireStudent(locals: App.Locals): Guarded {
  const guarded = requireAccount(locals)
  if (isStudent(guarded.account)) return guarded
  redirect(303, accountRole(guarded.account) === 'teacher' ? '/prof' : '/profil')
}

/**
 * Les pages de l'espace professeur.
 *
 * Tout y est en lecture : les routes enseignant ne sont connues qu'en lecture, et aucune
 * écriture professeur n'est documentée. Un profil élève ou parent qui arrive ici repart vers
 * son propre accueil.
 */
export function requireTeacher(locals: App.Locals): Guarded {
  const guarded = requireAccount(locals)
  if (accountRole(guarded.account) !== 'teacher') redirect(303, '/')
  return guarded
}

export function roleOf(locals: App.Locals): string {
  const record = locals.session
  const account = record ? activeAccount(record) : null
  return account ? accountRole(account) : 'unknown'
}
