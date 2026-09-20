import { describe, expect, it } from 'vitest'
import { EcoleDirecteClient, choiceForDate } from '../src/client.js'
import { createSession } from '../src/session.js'
import type { HttpEngine, HttpRequest, HttpResponse } from '../src/transport.js'
import { FakeEngine, GTK_EXCHANGE, loginResponse } from './fake.js'

/**
 * Un moteur qui répond **dans l'ordre** pour une même route.
 *
 * Le moteur factice habituel rend toujours la même réponse à une URL donnée ; ici il faut
 * qu'un second essai puisse réussir là où le premier a échoué, sans quoi on ne teste pas un
 * renouvellement mais une répétition.
 */
class MoteurSequence implements HttpEngine {
  readonly requests: HttpRequest[] = []

  constructor(private readonly suites: Record<string, Array<{ code: number; data?: unknown }>>) {}

  async send(request: HttpRequest): Promise<HttpResponse> {
    this.requests.push(request)
    const cle = Object.keys(this.suites).find((fragment) => request.url.includes(fragment))
    if (!cle) throw new Error(`Aucune réponse préparée pour ${request.url}`)
    const suite = this.suites[cle] as Array<{ code: number; data?: unknown }>
    const reponse = suite.length > 1 ? (suite.shift() as { code: number; data?: unknown }) : (suite[0] as { code: number; data?: unknown })
    return {
      status: 200,
      headers: {},
      body: JSON.stringify({ code: reponse.code, message: '', token: 'JETON', data: reponse.data ?? null }),
    }
  }

  /** Combien de fois une route a été appelée. */
  appels(fragment: string): number {
    return this.requests.filter((requete) => requete.url.includes(fragment)).length
  }
}

function clientAvecJeton(moteur: HttpEngine) {
  return new EcoleDirecteClient({
    engine: moteur,
    session: createSession({ token: 'PERIME', userId: '4021' }),
  })
}

describe('renouvellement du jeton', () => {
  it('renouvelle et rejoue une lecture, une seule fois', async () => {
    // Le jeton tourne à chaque requête : une pause suffit à le périmer, et cela se voyait
    // jusqu'ici comme une déconnexion en plein milieu d'une consultation.
    const moteur = new MoteurSequence({
      'notes.awp': [{ code: 525 }, { code: 200, data: { notes: [] } }],
      'renewtoken.awp': [{ code: 200 }],
    })
    const result = await clientAvecJeton(moteur).call('/eleves/4021/notes.awp', { verb: 'get' })

    expect(result.ok).toBe(true)
    expect(moteur.appels('renewtoken.awp')).toBe(1)
    expect(moteur.appels('notes.awp')).toBe(2)
  })

  it('ne tourne jamais en boucle si le second essai échoue aussi', async () => {
    const moteur = new MoteurSequence({
      'notes.awp': [{ code: 525 }],
      'renewtoken.awp': [{ code: 200 }],
    })
    const result = await clientAvecJeton(moteur).call('/eleves/4021/notes.awp', { verb: 'get' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.kind).toBe('session-expired')
    // Deux appels, pas trois : un seul renouvellement, un seul réessai.
    expect(moteur.appels('notes.awp')).toBe(2)
    expect(moteur.appels('renewtoken.awp')).toBe(1)
  })

  it('ne rejoue pas une écriture', async () => {
    // Si le service avait agi avant d'annoncer que le jeton ne vaut plus, la rejouer
    // enverrait deux fois le même commentaire. Le jeton est renouvelé, le geste ne l'est pas.
    const moteur = new MoteurSequence({
      'cahierdetexte.awp': [{ code: 525 }, { code: 200 }],
      'renewtoken.awp': [{ code: 200 }],
    })
    const client = clientAvecJeton(moteur)
    client.writePolicy = 'allow'
    const result = await client.call('/Eleves/4021/cahierdetexte.awp', { verb: 'put', write: true, body: {} })

    expect(result.ok).toBe(false)
    expect(moteur.appels('cahierdetexte.awp')).toBe(1)
    expect(moteur.appels('renewtoken.awp')).toBe(1)
  })

  it('ne tente rien sans titulaire connu', async () => {
    // `renewtoken.awp` exige l'identifiant du compte : sans lui, il n'y a rien à tenter.
    const moteur = new MoteurSequence({ 'notes.awp': [{ code: 525 }] })
    const client = new EcoleDirecteClient({ engine: moteur, session: createSession({ token: 'PERIME' }) })
    const result = await client.call('/eleves/4021/notes.awp', { verb: 'get' })

    expect(result.ok).toBe(false)
    expect(moteur.appels('notes.awp')).toBe(1)
  })

  it('retient le titulaire au login, sans quoi rien n’est renouvelable', async () => {
    const moteur = new FakeEngine([
      GTK_EXCHANGE,
      loginResponse(200, {
        accounts: [{ id: 4021, typeCompte: 'E', prenom: 'Camille', nom: 'Bernard', modules: [] }],
      }),
    ])
    const client = new EcoleDirecteClient({ engine: moteur, session: createSession() })
    await client.login('camille', 'secret')
    expect(client.session.userId).toBe('4021')
  })
})

describe('date de naissance et question de sécurité', () => {
  it('reconnaît la date sous les écritures du service', () => {
    // Le service écrit ses dates de plusieurs façons ; les comparer après lecture n'est pas
    // approcher une réponse, c'est reconnaître la même valeur.
    expect(choiceForDate(['15/03/2009', '02/11/2008'], '2009-03-15')).toBe('15/03/2009')
    expect(choiceForDate(['15 mars 2009', '2 novembre 2008'], '2009-03-15')).toBe('15 mars 2009')
    expect(choiceForDate(['2009-03-15'], '2009-03-15')).toBe('2009-03-15')
    // Le mois accentué se lit aussi.
    expect(choiceForDate(['3 février 2009'], '2009-02-03')).toBe('3 février 2009')
  })

  it('rend la proposition du serveur telle quelle, jamais une chaîne recomposée', () => {
    // C'est ce qui garde la promesse : la réponse envoyée est **celle du serveur**.
    expect(choiceForDate(['1/3/2009'], '2009-03-01')).toBe('1/3/2009')
  })

  it('ne répond pas si aucune proposition n’est cette date', () => {
    expect(choiceForDate(['15/03/2009', '02/11/2008'], '2010-01-01')).toBeNull()
  })

  it('ne répond pas si la question porte sur autre chose', () => {
    // Ville de naissance, prénom : rien ne se lit comme une date, donc on pose la question.
    expect(choiceForDate(['Marseille', 'Lyon', 'Brest'], '2009-03-15')).toBeNull()
  })

  it('ne tranche pas entre deux propositions identiques', () => {
    // Dans le doute, la question se pose. Jamais de choix au hasard.
    expect(choiceForDate(['15/03/2009', '15 mars 2009'], '2009-03-15')).toBeNull()
  })

  it('refuse une date mal formée plutôt que de l’interpréter', () => {
    expect(choiceForDate(['15/03/2009'], '15/03/2009')).toBeNull()
    expect(choiceForDate(['15/03/2009'], '')).toBeNull()
  })
})
