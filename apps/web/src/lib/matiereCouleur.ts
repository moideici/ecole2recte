/**
 * Une couleur stable par matière, puisée dans les jetons pour suivre le thème clair/sombre.
 *
 * Ce sont les dix couleurs de matière de l'application Android, attribuées comme elle le fait
 * (`colorFor` : hachage du nom en minuscules, l'algorithme de `String.hashCode` de Java) — une
 * matière a donc la même couleur sur le site et sur le téléphone. Un hachage du nom, pas un
 * compteur, pour ne pas dépendre de l'ordre dans lequel les matières apparaissent.
 *
 * `fond` est l'aplat à 18 % de l'application, `encre` la même teinte rendue lisible (AA) sur
 * cet aplat comme sur la surface : les deux jetons sont définis dans `app.css`, par mode.
 */
export const NOMBRE_COULEURS_MATIERE = 10

export interface CouleurMatiere {
  fond: string
  encre: string
}

/** Le rang de la couleur d'une matière, entre 0 et 9 — le même que dans l'application. */
export function rangMatiere(nom: string | undefined | null): number {
  const texte = (nom?.trim() || '?').toLocaleLowerCase('fr')
  let hachage = 0
  for (let i = 0; i < texte.length; i++) {
    hachage = (hachage * 31 + texte.charCodeAt(i)) | 0
  }
  return Math.abs(hachage) % NOMBRE_COULEURS_MATIERE
}

export function couleurMatiere(nom: string | undefined | null): CouleurMatiere {
  const rang = rangMatiere(nom)
  return { fond: `var(--matiere-${rang}-fond)`, encre: `var(--matiere-${rang}-encre)` }
}
