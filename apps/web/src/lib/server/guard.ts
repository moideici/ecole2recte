import { redirect } from '@sveltejs/kit'
import { type Account, accountRole, isStudent, viewedByFamily } from '@ecole2recte/protocol'
import { activeAccount } from './session.js'
import type { SessionRecord } from './store.js'
import { type WriteFeature, isWriteEnabled } from './write-policy.js'

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

/**
 * Une écriture est-elle réellement possible ici ?
 *
 * Trois conditions, et il les faut toutes. La **fonction** doit être ouverte. On doit être
 * l'**élève** : depuis une vue parent, cocher enverrait un geste que l'enfant n'a pas fait.
 * Et la session ne doit pas être une **démonstration** : son moteur refuse toute écriture, et
 * proposer un bouton qui échoue à chaque clic est pire que ne rien proposer.
 */
export function peutEcrire(guarded: Guarded, feature: WriteFeature): boolean {
  if (guarded.record.demo === true) return false
  if (viewedByFamily(guarded.account)) return false
  return isWriteEnabled(feature)
}

export function roleOf(locals: App.Locals): string {
  const record = locals.session
  const account = record ? activeAccount(record) : null
  return account ? accountRole(account) : 'unknown'
}
