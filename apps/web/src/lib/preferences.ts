export const PALETTES = [
  ['indigo', 'Indigo'],
  ['ocean', 'Océan'],
  ['foret', 'Forêt'],
  ['coucher', 'Coucher de soleil'],
  ['ardoise', 'Ardoise'],
] as const

export const TAILLES = [
  ['petit', 'Petit'],
  ['normal', 'Normal'],
  ['grand', 'Grand'],
  ['tres-grand', 'Très grand'],
] as const

export type Palette = typeof PALETTES[number][0]
export type Taille = typeof TAILLES[number][0]
