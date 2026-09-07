/**
 * Le transport, réduit à une interface.
 *
 * Le client ne connaît pas `fetch` : il connaît `HttpEngine`. C'est ce qui permet de tester
 * chaque requête sortante octet par octet contre un serveur factice, sans réseau et sans
 * compte — le seul moyen d'éprouver une écriture avant de la laisser partir.
 */

export type HttpMethod = 'GET' | 'POST'

export interface HttpRequest {
  method: HttpMethod
  url: string
  headers: Record<string, string>
  body?: string
}

export interface HttpResponse {
  status: number
  /** En-têtes en minuscules ; une clé peut porter plusieurs valeurs (`set-cookie`). */
  headers: Record<string, string[]>
  body: string
}

/** Une réponse binaire : une pièce jointe n'est pas du texte. */
export interface BinaryResponse {
  status: number
  headers: Record<string, string[]>
  bytes: Uint8Array
}

export interface HttpEngine {
  send(request: HttpRequest): Promise<HttpResponse>
  /** Facultatif : sans lui, les téléchargements ne sont pas proposés. */
  download?(request: HttpRequest): Promise<BinaryResponse>
}

/** Le réseau n'a pas répondu du tout — à distinguer d'un refus, qui est une réponse. */
export class NetworkFailure extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'NetworkFailure'
  }
}

export function headerValue(headers: Record<string, string[]>, name: string): string | null {
  const values = headers[name.toLowerCase()]
  return values && values.length > 0 ? (values[0] as string) : null
}

export function fetchEngine(fetchImpl: typeof fetch = fetch): HttpEngine {
  return {
    async send(request: HttpRequest): Promise<HttpResponse> {
      let response: Response
      try {
        response = await fetchImpl(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body,
          redirect: 'follow',
        })
      } catch (cause) {
        throw new NetworkFailure('Le service est injoignable.', { cause })
      }
      const headers: Record<string, string[]> = {}
      // `getSetCookie` existe pour cette raison précise : plusieurs `set-cookie` ne se
      // laissent pas lire par `headers.get`, qui les recolle en une seule chaîne.
      const setCookie = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : []
      if (setCookie.length > 0) headers['set-cookie'] = setCookie
      response.headers.forEach((value, key) => {
        const name = key.toLowerCase()
        if (name === 'set-cookie' && setCookie.length > 0) return
        const existing = headers[name]
        if (existing) existing.push(value)
        else headers[name] = [value]
      })
      return { status: response.status, headers, body: await response.text() }
    },

    async download(request: HttpRequest): Promise<BinaryResponse> {
      let response: Response
      try {
        response = await fetchImpl(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body,
          redirect: 'follow',
        })
      } catch (cause) {
        throw new NetworkFailure('Le service est injoignable.', { cause })
      }
      const headers: Record<string, string[]> = {}
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = [value]
      })
      return { status: response.status, headers, bytes: new Uint8Array(await response.arrayBuffer()) }
    },
  }
}
