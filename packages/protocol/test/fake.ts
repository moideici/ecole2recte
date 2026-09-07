import type { HttpEngine, HttpRequest, HttpResponse } from '../src/transport.js'

export interface Exchange {
  /** Fragment attendu dans l'URL, pour associer une réponse à un appel. */
  match: string
  status?: number
  headers?: Record<string, string[]>
  body: unknown
}

/**
 * Un serveur ÉcoleDirecte factice.
 *
 * Il retient **chaque requête sortante**, ce qui permet de vérifier ce que l'on envoie et
 * pas seulement ce que l'on comprend. C'est la seule façon d'attraper un corps de message
 * tronqué avant qu'il ne parte pour de vrai.
 */
export class FakeEngine implements HttpEngine {
  readonly requests: HttpRequest[] = []

  constructor(private readonly exchanges: Exchange[]) {}

  async send(request: HttpRequest): Promise<HttpResponse> {
    this.requests.push(request)
    const exchange = this.exchanges.find((candidate) => request.url.includes(candidate.match))
    if (!exchange) throw new Error(`Aucune réponse préparée pour ${request.url}`)
    return {
      status: exchange.status ?? 200,
      headers: exchange.headers ?? {},
      body: typeof exchange.body === 'string' ? exchange.body : JSON.stringify(exchange.body),
    }
  }

  /** Le corps `data=` d'une requête, redevenu un objet. */
  sentBody(index: number): unknown {
    const body = this.requests[index]?.body ?? ''
    const raw = body.startsWith('data=') ? body.slice('data='.length) : body
    return JSON.parse(decodeURIComponent(raw))
  }

  /** Le corps `data=` tel quel, avant décodage : c'est lui que le serveur reçoit. */
  sentRaw(index: number): string {
    return this.requests[index]?.body ?? ''
  }
}

export const GTK_EXCHANGE: Exchange = {
  match: 'gtk=1',
  headers: { 'x-gtk': ['GTK-DE-TEST'], 'set-cookie': ['GTK=GTK-DE-TEST; Path=/; Secure; HttpOnly'] },
  body: { code: 200, message: '', data: null },
}

export function loginResponse(code: number, data: unknown = null, message = ''): Exchange {
  return {
    match: 'login.awp',
    headers: { 'x-token': ['JETON-DE-TEST'], '2fa-token': ['JETON-2FA'] },
    body: { code, message, data },
  }
}

export const STUDENT_PAYLOAD = {
  accounts: [
    {
      id: 4242,
      typeCompte: 'E',
      prenom: 'Camille',
      nom: 'Durand',
      nomEtablissement: 'Lycée Victor Hugo',
      modules: [
        { code: 'NOTES', enable: true },
        { code: 'CAHIER_DE_TEXTES', enable: true },
        { code: 'CLOUD', enable: false },
      ],
      profile: { classe: { libelle: '1re G2' } },
    },
  ],
}

export const FAMILY_PAYLOAD = {
  accounts: [
    {
      id: 99,
      typeCompte: '1',
      prenom: 'Sophie',
      nom: 'Durand',
      nomEtablissement: 'Lycée Victor Hugo',
      modules: [{ code: 'MESSAGERIE', enable: true }],
      profile: {
        eleves: [
          {
            id: 4242,
            prenom: 'Camille',
            nom: 'Durand',
            classe: { libelle: '1re G2' },
            modules: [{ code: 'NOTES', enable: true }],
          },
          {
            id: 4243,
            prenom: 'Louis',
            nom: 'Durand',
            classe: '5e B',
            modules: [{ code: 'NOTES', enable: true }],
          },
        ],
      },
    },
  ],
}
