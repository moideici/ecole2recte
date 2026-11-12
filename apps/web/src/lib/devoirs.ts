import { isHomeworkDone, type HomeworkItem } from '@ecole2recte/protocol'

export type Filtre = 'afaire' | 'faits' | 'controles' | 'tous'

export function lireFiltre(valeur: string | null): Filtre {
  return valeur === 'faits' || valeur === 'controles' || valeur === 'tous' ? valeur : 'afaire'
}

export function filtrerDevoirs<T extends HomeworkItem>(devoirs: T[], filtre: Filtre, surcharges: Record<string, boolean> = {}): T[] {
  return devoirs.filter((item) => {
    if (filtre === 'tous') return true
    if (filtre === 'controles') return item.exam === true
    return isHomeworkDone(item, surcharges) === (filtre === 'faits')
  })
}

export function joursAvantControle(devoirs: HomeworkItem[], aujourdhui: string): { jours: number; item: HomeworkItem } | undefined {
  const item = devoirs.filter((item) => item.exam && item.dueDate >= aujourdhui)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
  if (!item) return undefined
  return { jours: Math.round((Date.parse(item.dueDate) - Date.parse(aujourdhui)) / 86_400_000), item }
}
