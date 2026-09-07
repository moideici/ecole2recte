import { createServer, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import * as fixtures from './fixtures.js'

/**
 * Un ÉcoleDirecte factice, en vrai HTTP.
 *
 * Le moteur `fetch` réel parle à ce serveur : on éprouve donc aussi le transport — cookies
 * multiples, en-têtes rapportés, corps `data=` réellement reçu — et pas seulement notre idée
 * du transport. Il rend les codes métier comme le vrai : **HTTP 200, même pour refuser**.
 */
export interface FakeServer {
  url: string
  requests: Array<{ method: string; path: string; body: string; headers: Record<string, string | undefined> }>
  /** Force le prochain appel correspondant à répondre ce code métier. */
  fail(match: string, code: number, message?: string): void
  close(): Promise<void>
}

export async function startFakeServer(): Promise<FakeServer> {
  const requests: FakeServer['requests'] = []
  const failures = new Map<string, { code: number; message: string }>()

  const server: Server = createServer((request, response) => {
    let body = ''
    request.on('data', (chunk) => (body += chunk))
    request.on('end', () => {
      const path = request.url ?? ''
      requests.push({
        method: request.method ?? '',
        path,
        body,
        headers: {
          token: request.headers['x-token'] as string | undefined,
          gtk: request.headers['x-gtk'] as string | undefined,
          agent: request.headers['user-agent'] as string | undefined,
          cookie: request.headers['cookie'] as string | undefined,
        },
      })

      const panne = [...failures.entries()].find(([match]) => path.includes(match))
      if (panne) {
        failures.delete(panne[0])
        return json(response, { code: panne[1].code, message: panne[1].message, data: null })
      }

      if (path.includes('gtk=1')) {
        response.setHeader('X-GTK', 'GTK-FACTICE')
        // Deux cookies : c'est le cas que `headers.get` recolle et perd.
        response.setHeader('Set-Cookie', ['GTK=GTK-FACTICE; Path=/; HttpOnly', 'SID=abc; Path=/; Secure'])
        return json(response, { code: 200, message: '', data: null })
      }

      response.setHeader('X-Token', 'JETON-FACTICE')
      response.setHeader('2FA-Token', 'JETON-2FA')

      if (path.includes('/login.awp')) return json(response, { code: 200, data: COMPTES })
      if (path.includes('emploidutemps')) return json(response, { code: 200, data: fixtures.TIMETABLE })
      if (path.includes('cahierdetexte/')) return json(response, { code: 200, data: fixtures.DAY_CONTENT })
      if (path.includes('cahierdetexte')) return json(response, { code: 200, data: fixtures.HOMEWORK_SUMMARY })
      if (path.includes('notes.awp')) return json(response, { code: 200, data: fixtures.GRADES })
      if (path.includes('viescolaire')) return json(response, { code: 200, data: fixtures.SCHOOL_LIFE })
      if (path.includes('messages.awp')) return json(response, { code: 200, data: fixtures.MESSAGES })
      if (path.includes('elevesDocuments')) return json(response, { code: 200, data: fixtures.DOCUMENTS })
      if (path.includes('viedeletablissement')) return json(response, { code: 200, data: fixtures.NEWS })
      if (path.includes('manuelsnumeriques')) return json(response, { code: 200, data: fixtures.TEXTBOOKS })
      if (path.includes('cloud.awp')) return json(response, { code: 200, data: fixtures.CLOUD })
      return json(response, { code: 200, data: null })
    })
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as AddressInfo).port

  return {
    url: `http://127.0.0.1:${port}/v3`,
    requests,
    fail(match, code, message = '') {
      failures.set(match, { code, message })
    },
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  }
}

function json(response: ServerResponse, body: unknown): void {
  response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

export const COMPTES = {
  accounts: [
    {
      id: 4242,
      typeCompte: 'E',
      prenom: 'Camille',
      nom: 'Durand',
      nomEtablissement: 'Lycée Victor Hugo',
      modules: [{ code: 'NOTES', enable: true }],
      profile: { classe: { libelle: '1re G2' } },
    },
  ],
}
