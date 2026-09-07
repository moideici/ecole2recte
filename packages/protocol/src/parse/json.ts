/**
 * Lecture défensive du JSON d'ÉcoleDirecte.
 *
 * L'API n'est ni publique ni documentée : une clé absente chez un établissement est
 * présente chez le suivant, un nombre arrive tantôt en nombre tantôt en chaîne, une date
 * tantôt en `2026-09-07` tantôt en `07/09/2026`. Aucune de ces fonctions ne lève : une
 * réponse à moitié comprise vaut mieux qu'un écran vide.
 */

export type Json = Record<string, unknown>

export function asObject(value: unknown): Json | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : null
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/** Les objets d'un tableau, les autres éléments écartés sans bruit. */
export function objects(value: unknown): Json[] {
  return asArray(value).filter((item): item is Json => asObject(item) !== null)
}

export function text(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return ''
}

/** Le premier champ renseigné parmi plusieurs orthographes possibles. */
export function pick(source: Json, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = source[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

export function pickText(source: Json, ...keys: string[]): string {
  return text(pick(source, ...keys))
}

/** Un nombre, y compris écrit « 12,5 » — la virgule est la norme côté français. */
export function number(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value !== 'string') return undefined
  const cleaned = value.trim().replace(',', '.')
  if (cleaned === '') return undefined
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function pickNumber(source: Json, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const parsed = number(source[key])
    if (parsed !== undefined) return parsed
  }
  return undefined
}

/** Un booléen tolérant : `true`, `"1"`, `1`, `"true"` disent tous oui. */
export function bool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const cleaned = value.trim().toLowerCase()
    if (cleaned === '') return fallback
    return cleaned === 'true' || cleaned === '1' || cleaned === 'oui'
  }
  return fallback
}

export function pickBool(source: Json, keys: string[], fallback = false): boolean {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return bool(source[key], fallback)
  }
  return fallback
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/
const FRENCH_DATE = /^(\d{2})\/(\d{2})\/(\d{4})/

/**
 * Une date en ISO `2026-09-07`, quelle que soit la façon dont elle est arrivée.
 *
 * Aucune conversion de fuseau : l'heure d'un cours est celle de l'établissement, et la
 * réinterpréter dans le fuseau du serveur décale l'emploi du temps d'une heure deux fois
 * par an.
 */
export function isoDate(value: unknown): string | undefined {
  const raw = text(value).trim()
  if (raw === '') return undefined
  const iso = ISO_DATE.exec(raw)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const french = FRENCH_DATE.exec(raw)
  if (french) return `${french[3]}-${french[2]}-${french[1]}`
  return undefined
}

/** Un instant local `2026-09-07T10:15:00`, sans fuseau et sans `Z`. */
export function isoDateTime(value: unknown): string | undefined {
  const raw = text(value).trim()
  if (raw === '') return undefined
  const date = isoDate(raw)
  if (!date) return undefined
  const time = /(\d{2}):(\d{2})(?::(\d{2}))?/.exec(raw.slice(10))
  if (!time) return `${date}T00:00:00`
  return `${date}T${time[1]}:${time[2]}:${time[3] ?? '00'}`
}

export function pickDate(source: Json, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const parsed = isoDate(source[key])
    if (parsed) return parsed
  }
  return undefined
}

export function pickDateTime(source: Json, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const parsed = isoDateTime(source[key])
    if (parsed) return parsed
  }
  return undefined
}

/** Le nom d'une personne, recollé depuis les morceaux que le service veut bien donner. */
export function personName(source: Json | null): string {
  if (!source) return ''
  const direct = pickText(source, 'nom_complet', 'nomComplet', 'libelle')
  const civility = pickText(source, 'civilite')
  const first = pickText(source, 'prenom')
  const particle = pickText(source, 'particule')
  const last = pickText(source, 'nom')
  const built = [civility, first, particle, last].filter((part) => part !== '').join(' ').trim()
  if (built !== '') return built
  return direct
}

/**
 * Retire le balisage d'un contenu HTML pour en faire un texte lisible.
 *
 * Un paragraphe devient une ligne vide et un `<br>` un simple retour : sans cette
 * distinction, un message d'établissement arrive en un seul bloc illisible.
 */
export function plainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
