import type { SessionRecord } from './store.js'

/** Trente entrées : de quoi voir une panne qui dure, pas de quoi grossir l'enregistrement. */
export const JOURNAL_MAX = 30

type Entree = NonNullable<SessionRecord['journal']>[number]

/**
 * Ne garde que la forme d'une page : `/devoirs/2026-11-12` et `/messages/48213` deviennent
 * `/devoirs/…` et `/messages/…`. Une date ou un identifiant dit quand ou quoi on consulte —
 * le journal n'a besoin que de savoir où.
 */
export function pageSansValeur(chemin: string): string {
  const morceaux = chemin.split('/').filter(Boolean)
  if (morceaux.length <= 1) return `/${morceaux[0] ?? ''}`
  return `/${morceaux[0]}/…`
}

/** Ajoute une entrée en gardant les `JOURNAL_MAX` plus récentes, sans valeur personnelle. */
export function ajouterAuJournal(record: SessionRecord, entree: Entree): void {
  const journal = [...(record.journal ?? []), { ...entree, page: pageSansValeur(entree.page) }]
  record.journal = journal.slice(-JOURNAL_MAX)
}
