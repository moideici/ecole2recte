/**
 * Une couleur par matière, comme sur Pronote — chaque paire (fond pastel, encre foncée) vient
 * de son propre nuancier. La couleur est stable pour une matière donnée : un hachage du nom,
 * pas un compteur, pour ne pas dépendre de l'ordre dans lequel les matières apparaissent.
 */
const PALETTE = [
  { fond: '#c7e7fc', encre: '#004b7b' },
  { fond: '#ffd7df', encre: '#722241' },
  { fond: '#97e47c', encre: '#1c5700' },
  { fond: '#f7c983', encre: '#643c00' },
  { fond: '#cdf3ed', encre: '#0b5c5f' },
  { fond: '#ccd3ff', encre: '#2d2d7a' },
  { fond: '#e6d5c3', encre: '#4a3728' },
  { fond: '#ebdbff', encre: '#4b2e83' },
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
