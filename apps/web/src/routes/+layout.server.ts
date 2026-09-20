import type { LayoutServerLoad } from './$types'
import { activeAccount } from '$lib/server/session.js'
import { enabledWriteFeatures, writePolicy } from '$lib/server/write-policy.js'
import { accountRole, displayName, initials, isStudent, viewedByFamily } from '@ecole2recte/protocol'

/**
 * Ce que toute page connaît : qui est connecté, quels profils sont lisibles, et ce que
 * l'application s'autorise à écrire.
 *
 * Rien de secret ne descend : ni jeton, ni cookie, ni identifiant ÉcoleDirecte du titulaire.
 */
export const load: LayoutServerLoad = ({ locals, url }) => {
  const record = locals.session
  const account = record ? activeAccount(record) : null

  return {
    connecte: record !== null && account !== null,
    chemin: url.pathname,
    demo: record?.demo === true,
    profil: account
      ? {
          id: account.id,
          nom: displayName(account),
          initiales: initials(account),
          classe: account.className,
          etablissement: account.schoolName,
          eleve: isStudent(account),
          // Un parent ne se voit pas tutoyé : l'application parle de l'enfant.
          parent: viewedByFamily(account),
          prof: accountRole(account) === 'teacher',
          famille: account.familyName ?? '',
          // Seuls les modules déclarés fermés masquent une section : un module que le service
          // ne nomme pas ne prouve rien.
          modulesFermes: account.modules.filter((module) => !module.enabled).map((module) => module.code.toUpperCase()),
        }
      : null,
    enfants:
      record?.accounts.map((entry) => ({
        id: entry.id,
        nom: displayName(entry),
        initiales: initials(entry),
        classe: entry.className,
      })) ?? [],
    ecriture: { police: writePolicy(), fonctions: enabledWriteFeatures() },
  }
}
