/**
 * Le modèle, réduit pour l'instant à ce que la connexion produit.
 *
 * Les entités scolaires (cours, devoirs, notes…) arrivent en P1. Ce fichier ne porte que ce
 * dont l'authentification a besoin, pour que P0 soit fini et non pas commencé partout.
 */

/** Un module ouvert par l'établissement pour ce compte. */
export interface AccountModule {
  code: string
  enabled: boolean
}

export interface Account {
  id: string
  /** `typeCompte` tel que rendu : `E` pour un élève, autre chose pour une famille. */
  type: string
  firstName: string
  lastName: string
  className: string
  schoolName: string
  /** Renseigné quand ce profil vient d'un compte famille : l'identifiant du titulaire. */
  familyId?: string
  familyName?: string
  /**
   * Ce que l'établissement a réellement ouvert. C'est la source de vérité des
   * fonctionnalités : rien ne doit être codé en dur par rôle.
   */
  modules: AccountModule[]
}

export function isStudent(account: Account): boolean {
  return account.type.toUpperCase() === 'E'
}

/** Vrai pour un enfant consulté depuis un compte parent. */
export function viewedByFamily(account: Account): boolean {
  return account.familyId !== undefined && account.familyId !== ''
}

/**
 * La boîte aux lettres appartient au titulaire de la connexion, pas au profil consulté :
 * un parent lit la messagerie de la famille, pas celle de son enfant. Confondre les deux
 * fait répondre « accès refusé » à tous les appels.
 */
export function mailboxId(account: Account): string {
  return viewedByFamily(account) ? (account.familyId as string) : account.id
}

export function mailboxSegment(account: Account): 'eleves' | 'familles' {
  return viewedByFamily(account) || !isStudent(account) ? 'familles' : 'eleves'
}

export function displayName(account: Account): string {
  return [account.firstName, account.lastName].filter((part) => part !== '').join(' ')
}

export function hasModule(account: Account, code: string): boolean {
  const wanted = code.toUpperCase()
  return account.modules.some((module) => module.enabled && module.code.toUpperCase() === wanted)
}
