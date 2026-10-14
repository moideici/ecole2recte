/*
 * Une requête à la fois, par session.
 *
 * Le jeton d'ÉcoleDirecte tourne à chaque appel, et chaque requête réécrit la session en
 * entier. Deux requêtes simultanées (une page et le préchargement d'une autre, deux onglets)
 * lisaient le même jeton, et la dernière à écrire remettait un jeton déjà tourné : la requête
 * suivante tombait sur un jeton mort, ce qui se payait en reconnexion — ou en déconnexion pour
 * qui n'avait pas coché « rester connecté ». On les met donc en file, et la session est lue
 * **après** avoir obtenu son tour, pour qu'elle porte le dernier jeton.
 *
 * Cela ne couvre qu'une isolate ; c'est celle où se produisent les rafales d'un même onglet.
 * L'attente est bornée : une requête bloquée ne doit pas figer toutes les suivantes.
 */
export const ATTENTE_MAX_MS = 20_000
const files = new Map<string, Promise<void>>()

export async function enFile<T>(cle: string, tache: () => Promise<T>): Promise<T> {
  const precedente = files.get(cle) ?? Promise.resolve()
  let liberer!: () => void
  const suivante = new Promise<void>((resolve) => (liberer = resolve))
  const queue = precedente.then(() => suivante)
  files.set(cle, queue)

  let minuterie: ReturnType<typeof setTimeout> | undefined
  await Promise.race([
    precedente,
    new Promise<void>((resolve) => (minuterie = setTimeout(resolve, ATTENTE_MAX_MS))),
  ])
  clearTimeout(minuterie)
  try {
    return await tache()
  } finally {
    liberer()
    if (files.get(cle) === queue) files.delete(cle)
  }
}

