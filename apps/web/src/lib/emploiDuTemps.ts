import type { Lesson } from '@ecole2recte/protocol'

/** Ne fusionner que des séances identiques et contiguës : un groupe reste distinct. */
export function fusionnerCours(cours: Lesson[]): Lesson[] {
  const resultat: Lesson[] = []
  for (const entree of [...cours].sort((a, b) => a.start.localeCompare(b.start))) {
    const precedent = resultat.at(-1)
    if (precedent && precedent.end === entree.start &&
      precedent.start.slice(0, 10) === entree.start.slice(0, 10) &&
      ['subject', 'teacher', 'room', 'group', 'kind', 'canceled', 'exam', 'note', 'previousRoom', 'previousStart'].every(
        (cle) => precedent[cle as keyof Lesson] === entree[cle as keyof Lesson],
      )) {
      precedent.end = entree.end
    } else resultat.push({ ...entree })
  }
  return resultat
}

export function nomPause(debut: string, fin: string): string {
  return debut.slice(11, 16) < '14:00' && fin.slice(11, 16) > '12:00' ? 'Pause déjeuner' : 'Pause'
}

/** L'extrémité maximale évite d'inventer un creux entre des groupes simultanés. */
export function pauses(cours: Lesson[]): Array<{ start: string; end: string }> {
  const resultat: Array<{ start: string; end: string }> = []
  let fin = ''
  for (const entree of [...cours].sort((a, b) => a.start.localeCompare(b.start))) {
    if (fin && entree.start.slice(0, 10) === fin.slice(0, 10) && entree.start > fin) {
      resultat.push({ start: fin, end: entree.start })
    }
    if (entree.end > fin) fin = entree.end
  }
  return resultat
}
