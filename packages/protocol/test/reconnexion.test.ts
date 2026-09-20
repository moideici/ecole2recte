import { describe, expect, it } from 'vitest'
import { EcoleDirecteClient, choiceForDate, choiceForQuestion, readDate } from '../src/client.js'
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
    autoRenew: true,
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

  it('ne tente rien tant que le renouvellement n’est pas ouvert', async () => {
    /*
     * Le 20 septembre 2026, sur un vrai compte, `renewtoken.awp` a répondu par le message
     * d'activité suspecte du service — alors que le jeton valait encore, puisque la lecture
     * suivante est passée. Tant que sa forme n'est pas éprouvée, l'application ne l'appelle
     * pas : elle rend l'échec d'origine, comme avant qu'on écrive ce renouvellement.
     */
    const moteur = new MoteurSequence({
      'notes.awp': [{ code: 525 }, { code: 200, data: { notes: [] } }],
      'renewtoken.awp': [{ code: 200 }],
    })
    const client = new EcoleDirecteClient({
      engine: moteur,
      session: createSession({ token: 'PERIME', userId: '4021' }),
    })
    const result = await client.call('/eleves/4021/notes.awp', { verb: 'get' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.kind).toBe('session-expired')
    expect(moteur.appels('renewtoken.awp')).toBe(0)
    expect(moteur.appels('notes.awp')).toBe(1)
  })

  it('ne tente rien sans titulaire connu', async () => {
    // `renewtoken.awp` exige l'identifiant du compte : sans lui, il n'y a rien à tenter.
    const moteur = new MoteurSequence({ 'notes.awp': [{ code: 525 }] })
    const client = new EcoleDirecteClient({
      engine: moteur,
      session: createSession({ token: 'PERIME' }),
      autoRenew: true,
    })
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

describe('rouvrir la session quand le jeton est mort', () => {
  /*
   * `renewtoken.awp` étant refusé par le service, il reste la connexion complète — mais le
   * protocole ne la fait pas lui-même : il appelle `reauthenticate` et l'hôte se débrouille.
   * Le mot de passe n'entre jamais dans ce paquet, et c'est le point.
   */
  function clientQuiRouvre(moteur: HttpEngine, rouvrir: () => Promise<boolean>) {
    return new EcoleDirecteClient({
      engine: moteur,
      session: createSession({ token: 'PERIME', userId: '4021' }),
      reauthenticate: rouvrir,
    })
  }

  it('rouvre et rejoue la lecture, une seule fois', async () => {
    const moteur = new MoteurSequence({ 'notes.awp': [{ code: 525 }, { code: 200, data: { notes: [] } }] })
    let appels = 0
    const result = await clientQuiRouvre(moteur, async () => {
      appels += 1
      return true
    }).call('/eleves/4021/notes.awp', { verb: 'get' })

    expect(result.ok).toBe(true)
    expect(appels).toBe(1)
    expect(moteur.appels('notes.awp')).toBe(2)
  })

  it('n’insiste pas quand l’hôte n’a rien à rouvrir', async () => {
    // Pas de mot de passe gardé, ou plafond atteint : l'échec d'origine revient tel quel.
    const moteur = new MoteurSequence({ 'notes.awp': [{ code: 525 }] })
    const result = await clientQuiRouvre(moteur, async () => false).call('/eleves/4021/notes.awp', { verb: 'get' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.kind).toBe('session-expired')
    expect(moteur.appels('notes.awp')).toBe(1)
  })

  it('ne tourne jamais en boucle si le second essai échoue aussi', async () => {
    const moteur = new MoteurSequence({ 'notes.awp': [{ code: 525 }] })
    let appels = 0
    const result = await clientQuiRouvre(moteur, async () => {
      appels += 1
      return true
    }).call('/eleves/4021/notes.awp', { verb: 'get' })

    expect(result.ok).toBe(false)
    expect(appels).toBe(1)
    expect(moteur.appels('notes.awp')).toBe(2)
  })

  it('ne rejoue pas une écriture', async () => {
    // La session est rouverte — le geste, lui, se reprend à la main : le service a pu agir
    // avant d'annoncer que le jeton ne valait plus.
    const moteur = new MoteurSequence({ 'cahierdetexte.awp': [{ code: 525 }, { code: 200 }] })
    let appels = 0
    const client = clientQuiRouvre(moteur, async () => {
      appels += 1
      return true
    })
    client.writePolicy = 'allow'
    const result = await client.call('/Eleves/4021/cahierdetexte.awp', { verb: 'put', write: true, body: {} })

    expect(result.ok).toBe(false)
    expect(appels).toBe(1)
    expect(moteur.appels('cahierdetexte.awp')).toBe(1)
  })

  it('préfère le renouvellement quand il est ouvert, parce qu’il coûte moins cher', async () => {
    // Une requête légère contre trois : si `renewtoken.awp` suffit, on ne se reconnecte pas.
    const moteur = new MoteurSequence({
      'notes.awp': [{ code: 525 }, { code: 200, data: { notes: [] } }],
      'renewtoken.awp': [{ code: 200 }],
    })
    let appels = 0
    const client = new EcoleDirecteClient({
      engine: moteur,
      session: createSession({ token: 'PERIME', userId: '4021' }),
      autoRenew: true,
      reauthenticate: async () => {
        appels += 1
        return true
      },
    })
    const result = await client.call('/eleves/4021/notes.awp', { verb: 'get' })

    expect(result.ok).toBe(true)
    expect(appels).toBe(0)
    expect(moteur.appels('renewtoken.awp')).toBe(1)
  })

  it('se rabat sur la reconnexion quand le renouvellement est refusé', async () => {
    // C'est la situation réelle : le service refuse `renewtoken.awp`.
    const moteur = new MoteurSequence({
      'notes.awp': [{ code: 525 }, { code: 200, data: { notes: [] } }],
      'renewtoken.awp': [{ code: 535 }],
    })
    let appels = 0
    const client = new EcoleDirecteClient({
      engine: moteur,
      session: createSession({ token: 'PERIME', userId: '4021' }),
      autoRenew: true,
      reauthenticate: async () => {
        appels += 1
        return true
      },
    })
    const result = await client.call('/eleves/4021/notes.awp', { verb: 'get' })

    expect(result.ok).toBe(true)
    expect(appels).toBe(1)
    expect(moteur.appels('notes.awp')).toBe(2)
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

describe('la question change a chaque connexion', () => {
  /*
   * Releve sur un vrai compte, deux connexions d'affilee :
   *   « Quelle est votre annee de naissance ? »  -> 15 annees
   *   « Quel est votre jour de naissance ? »     -> des quantiemes
   * Puis, une autre fois : « Quelle est votre classe ? ».
   * Une reponse unique donnee d'avance ne pouvait donc pas convenir.
   */
  const NAISSANCE = '2011-02-28'
  const ANNEES = ['2000', '1999', '2005', '2012', '2009', '2004', '2011', '2013', '2010']
  const JOURS = ['4', '17', '28', '9', '30', '11', '2']
  const MOIS_LISTE = ['janvier', 'fevrier', 'mars', 'octobre']
  const DATES = ['28/02/2011', '01/09/2010', '14/07/2011']
  const CLASSES = ['1ERE G2', '1ERE G1', 'Terminale G3', '2NDE 4']

  it('rend l annee quand c est l annee qu on demande', () => {
    expect(choiceForQuestion('Quelle est votre année de naissance ?', ANNEES, [NAISSANCE])).toBe('2011')
  })

  it('rend le jour quand c est le jour qu on demande', () => {
    // Le piege exact qui a fait echouer l essai : le rang de l annee designait un jour.
    expect(choiceForQuestion('Quel est votre jour de naissance ?', JOURS, [NAISSANCE])).toBe('28')
  })

  it('rend le mois, chiffre ou en lettres', () => {
    expect(choiceForQuestion('Quel est votre mois de naissance ?', MOIS_LISTE, [NAISSANCE])).toBe('fevrier')
    expect(choiceForQuestion('Quel est votre mois de naissance ?', ['1', '2', '3'], [NAISSANCE])).toBe('2')
    expect(choiceForQuestion('Quel est votre mois de naissance ?', ['01', '02', '03'], [NAISSANCE])).toBe('02')
  })

  it('rend la date entiere quand c est elle qu on demande', () => {
    expect(choiceForQuestion('Quelle est votre date de naissance ?', DATES, [NAISSANCE])).toBe('28/02/2011')
  })

  it('rend la classe quand c est la classe qu on demande', () => {
    expect(choiceForQuestion('Quelle est votre classe ?', CLASSES, [NAISSANCE, '1ERE G2'])).toBe('1ERE G2')
    // La casse et les espaces sont de l'ecriture, pas du sens.
    expect(choiceForQuestion('Quelle est votre classe ?', CLASSES, ['terminale  g3'])).toBe('Terminale G3')
  })

  it('ne confond pas le jour avec le mois', () => {
    // Ne 02 : si l'on essayait toutes les parts a la fois, « 2 » et « 28 » matcheraient
    // tous deux dans une liste de quantiemes, et l'on repondrait au hasard.
    expect(choiceForQuestion('Quel est votre jour de naissance ?', ['2', '28', '15'], [NAISSANCE])).toBe('28')
    expect(choiceForQuestion('Quel est votre mois de naissance ?', ['2', '28', '15'], [NAISSANCE])).toBe('2')
  })

  it('ne repond pas sur un morceau de proposition', () => {
    expect(choiceForQuestion('Quelle est votre classe ?', CLASSES, ['G2'])).toBeNull()
    expect(choiceForQuestion('Quelle est votre classe ?', CLASSES, ['1ERE'])).toBeNull()
  })

  it('ne repond pas quand le fait donne ne repond pas a la question', () => {
    // Une classe donnee ne repond pas a une question sur l'annee, et inversement.
    expect(choiceForQuestion('Quelle est votre année de naissance ?', ANNEES, ['1ERE G2'])).toBeNull()
    expect(choiceForQuestion('Quelle est votre classe ?', CLASSES, [NAISSANCE])).toBeNull()
    expect(choiceForQuestion('Quelle est votre année de naissance ?', ANNEES, [])).toBeNull()
  })

  it('ne prend pas une classe pour une date', () => {
    // Le diagnostic comptait naguere « ce qui contient un chiffre » : `1ERE G2` en contient.
    expect(readDate('1ERE G2')).toBeUndefined()
    expect(readDate('2NDE 4')).toBeUndefined()
    expect(readDate('28/02/2011')).toBe('2011-02-28')
  })
})
