/**
 * Encodages exigés par ÉcoleDirecte.
 *
 * Rien ici n'est un choix : le service accepte une forme précise et refuse le reste. Trois
 * pièges méritent d'être nommés, parce qu'ils coûtent chacun une soirée à qui les découvre
 * seul.
 */

/** Ce que l'on sait sérialiser vers le service : du JSON, rien d'autre. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue | undefined }

const ESCAPES: Record<string, string> = {
  '"': '\\"',
  '\\': '\\\\',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
  '\b': '\\b',
  '\f': '\\f',
}

function quote(text: string): string {
  let out = '"'
  // Parcours par unité de code, et non par point de code : Python échappe une paire
  // de substitution en deux `\uXXXX`, et c'est exactement ce que cette boucle produit.
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] as string
    const escape = ESCAPES[char]
    if (escape !== undefined) {
      out += escape
      continue
    }
    const code = text.charCodeAt(index)
    if (code < 0x20 || code > 0x7e) {
      out += '\\u' + code.toString(16).padStart(4, '0')
      continue
    }
    out += char
  }
  return out + '"'
}

/**
 * Sérialise comme `json.dumps` de Python, et pas comme `JSON.stringify`.
 *
 * Deux différences, toutes deux visibles par le serveur : Python sépare ses éléments par
 * `", "` et ses clés de leur valeur par `": "` (avec l'espace), et son `ensure_ascii` par
 * défaut échappe tout caractère non ASCII en `\uXXXX`. Un accent envoyé brut ne produit pas
 * la même chaîne, donc pas la même signature de requête.
 */
export function pythonJson(value: JsonValue): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return quote(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null'
  if (Array.isArray(value)) return '[' + value.map((item) => pythonJson(item)).join(', ') + ']'
  const parts: string[] = []
  // L'ordre d'insertion des clés fait foi : `login.awp` est sensible à l'ordre.
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) continue
    parts.push(quote(key) + ': ' + pythonJson(item))
  }
  return '{' + parts.join(', ') + '}'
}

/** Le corps de toute requête : `data=<json urlencodé>`. */
export function formBody(value: JsonValue): string {
  return 'data=' + encodeURIComponent(pythonJson(value))
}

export function base64Encode(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/**
 * Décode en tolérant ce que le service se permet : retours à la ligne au milieu, et
 * remplissage `=` manquant à la fin. Un décodeur strict échoue sur les deux.
 */
export function base64Decode(text: string): string {
  const cleaned = text.replace(/\s+/g, '')
  const padded = cleaned + '='.repeat((4 - (cleaned.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/** Décode si l'on peut, rend la chaîne d'origine sinon : une question lisible vaut mieux qu'une exception. */
export function base64DecodeOrRaw(text: string): string {
  try {
    return base64Decode(text)
  } catch {
    return text
  }
}
