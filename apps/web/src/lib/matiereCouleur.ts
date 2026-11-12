/**
 * Une couleur stable par matière, puisée dans les jetons pour suivre le thème clair/sombre.
 * La couleur est stable pour une matière donnée : un hachage du nom,
 * pas un compteur, pour ne pas dépendre de l'ordre dans lequel les matières apparaissent.
 */
const PALETTE = [
  { fond: 'var(--accent-doux)', encre: 'var(--accent-fort)' },
  { fond: 'var(--erreur-doux)', encre: 'var(--erreur)' },
  { fond: 'var(--succes-doux)', encre: 'var(--succes)' },
  { fond: 'var(--alerte-doux)', encre: 'var(--alerte)' },
] as const

export interface CouleurMatiere {
  fond: string
  encre: string
}

export function couleurMatiere(nom: string | undefined | null): CouleurMatiere {
  const texte = nom?.trim() || '?'
  let hachage = 0
  for (let i = 0; i < texte.length; i++) {
    hachage = (hachage * 31 + texte.charCodeAt(i)) | 0
  }
  return PALETTE[Math.abs(hachage) % PALETTE.length] as CouleurMatiere
}
