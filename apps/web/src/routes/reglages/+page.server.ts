import type { PageServerLoad } from './$types'
import { ALL_SECTIONS, SECTION_LABELS, hasModule } from '@ecole2recte/protocol'
import { SECTION_MODULES } from '@ecole2recte/protocol'
import { WRITE_FEATURE_LABELS, isWriteEnabled, writePolicy } from '$lib/server/write-policy.js'
import { requireStudent } from '$lib/server/guard.js'

export const load: PageServerLoad = ({ locals }) => {
  const { record, account } = requireStudent(locals)

  return {
    modules: ALL_SECTIONS.map((section) => {
      const code = SECTION_MODULES[section]
      return {
        section,
        libelle: SECTION_LABELS[section],
        // Quand ÉcoleDirecte ne nomme pas de module pour une section, on ne peut rien
        // affirmer : le dire vaut mieux que d'afficher une croix trompeuse.
        connu: code !== undefined,
        ouvert: code === undefined ? null : hasModule(account, code),
      }
    }),
    ecriture: {
      police: writePolicy(),
      fonctions: (Object.keys(WRITE_FEATURE_LABELS) as Array<keyof typeof WRITE_FEATURE_LABELS>).map((feature) => ({
        code: feature,
        libelle: WRITE_FEATURE_LABELS[feature],
        ouverte: isWriteEnabled(feature),
      })),
    },
    session: {
      profils: record.accounts.length,
      // Aucune valeur de jeton n'est rendue : seulement leur présence.
      jeton: record.protocol.token !== null,
      version: record.protocol.apiVersion,
    },
  }
}
