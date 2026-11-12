/**
 * Le verrou de l'application : une protection d'écran, **pas** un chiffrement des données.
 *
 * Il sert à ce qu'une personne qui prend ton téléphone ou ton ordinateur ouvert n'ait pas
 * tes notes sous les yeux. Il ne protège pas contre quelqu'un qui maîtrise le navigateur
 * (outils de développement, profil copié) : la session, elle, vit côté serveur. Tout reste
 * sur l'appareil — le code ne part jamais vers le serveur.
 *
 * Le code (4 à 6 chiffres) n'est pas gardé : seul son haché PBKDF2 l'est, avec un sel propre.
 */

export const CLE_VERROU = 'e2r-verrou'
export const CLE_ACTIVITE = 'e2r-activite'

/** Les délais proposés, en minutes. 0 : dès que la page quitte l'écran. */
export const DELAIS = [0, 1, 5, 15] as const
export type Delai = typeof DELAIS[number]

export interface EtatVerrou {
  /** Sel aléatoire, base64. */
  sel: string
  /** PBKDF2-SHA256 du code, base64. */
  hash: string
  delai: Delai
  /** Identifiant d'un authentificateur de plateforme (empreinte, Windows Hello), base64. */
  webauthn?: string
}

const ITERATIONS = 150_000

export function codeValide(code: string): boolean {
  return /^\d{4,6}$/.test(code)
}

const enBase64 = (octets: ArrayBuffer | Uint8Array): string => {
  const vue = octets instanceof Uint8Array ? octets : new Uint8Array(octets)
  let texte = ''
  for (const octet of vue) texte += String.fromCharCode(octet)
  return btoa(texte)
}
const deBase64 = (texte: string): Uint8Array => Uint8Array.from(atob(texte), (c) => c.charCodeAt(0))

export async function hacherCode(code: string, sel: string): Promise<string> {
  const cle = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: deBase64(sel) as BufferSource, iterations: ITERATIONS },
    cle,
    256,
  )
  return enBase64(bits)
}

export async function creerVerrou(code: string, delai: Delai, webauthn?: string): Promise<EtatVerrou> {
  if (!codeValide(code)) throw new Error('Le code doit comporter 4 à 6 chiffres.')
  const sel = enBase64(crypto.getRandomValues(new Uint8Array(16)))
  return { sel, hash: await hacherCode(code, sel), delai, ...(webauthn ? { webauthn } : {}) }
}

/** Comparaison sans court-circuit : le temps ne dit rien sur le nombre de caractères justes. */
function egal(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function verifierCode(etat: EtatVerrou, code: string): Promise<boolean> {
  if (!codeValide(code)) return false
  return egal(await hacherCode(code, etat.sel), etat.hash)
}

/** Lit l'état gardé ; toute valeur inattendue vaut « pas de verrou », jamais une exception. */
export function lireVerrou(brut: string | null): EtatVerrou | null {
  if (!brut) return null
  try {
    const v = JSON.parse(brut) as Partial<EtatVerrou>
    if (typeof v.sel !== 'string' || typeof v.hash !== 'string') return null
    if (!DELAIS.includes(v.delai as Delai)) return null
    return { sel: v.sel, hash: v.hash, delai: v.delai as Delai, ...(typeof v.webauthn === 'string' ? { webauthn: v.webauthn } : {}) }
  } catch {
    return null
  }
}

/**
 * Faut-il verrouiller, après `inactifMs` sans activité ?
 * Délai 0 : toujours, dès que la page a été cachée ; au-delà : quand le délai est écoulé.
 */
export function doitVerrouiller(delai: Delai, inactifMs: number): boolean {
  return delai === 0 ? inactifMs >= 0 : inactifMs >= delai * 60_000
}

/** Attente imposée après des essais ratés : rien avant le cinquième, puis 30 s qui doublent, 15 min au plus. */
export function attenteApresEchecs(echecs: number): number {
  if (echecs < 5) return 0
  return Math.min(30_000 * 2 ** (echecs - 5), 15 * 60_000)
}

/** Les libellés des délais, pour Réglages. */
export function libelleDelai(delai: Delai): string {
  return delai === 0 ? 'Immédiatement' : delai === 1 ? 'Après 1 minute' : `Après ${delai} minutes`
}

export { enBase64, deBase64 }
