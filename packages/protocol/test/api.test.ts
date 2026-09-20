import { describe, expect, it } from 'vitest'
import { EcoleDirecteApi } from '../src/api.js'
import { EcoleDirecteClient } from '../src/client.js'
import type { Account } from '../src/models.js'
import { FakeEngine } from './fake.js'

/**
 * Ce que l'on envoie, et non ce que l'on comprend.
 *
 * Chaque appel est figé : chemin, verbe, paramètres, corps. Si l'un d'eux change, un test
 * échoue — ce qui est exactement le but. C'est le seul filet qui attrape une écriture mal
 * formée avant qu'elle ne parte pour de vrai.
 */

const ELEVE: Account = {
  id: '4242',
  type: 'E',
  firstName: 'Camille',
  lastName: 'Durand',
  className: '1re G2',
  schoolName: 'Lycée Victor Hugo',
  modules: [],
}

const ENFANT: Account = { ...ELEVE, familyId: '99', familyName: 'Sophie Durand' }

function api(policy: 'allow' | 'deny' | 'dry-run' = 'allow'): { api: EcoleDirecteApi; engine: FakeEngine } {
  const engine = new FakeEngine([{ match: '', body: { code: 200, data: null } }])
  const client = new EcoleDirecteClient({ engine, writePolicy: policy })
  client.session.token = 'JETON'
  return { api: new EcoleDirecteApi(client), engine }
}

describe('lecture', () => {
  const cas: Array<[string, (subject: EcoleDirecteApi) => Promise<unknown>, string, unknown]> = [
    [
      'emploi du temps',
      (subject) => subject.timetable(ELEVE, '2026-09-01', '2026-09-30'),
      'https://api.ecoledirecte.com/v3/E/4242/emploidutemps.awp?verbe=get&v=4.101.4',
      { dateDebut: '2026-09-01', dateFin: '2026-09-30', avecTrous: false },
    ],
    [
      'cahier de textes',
      (subject) => subject.homework(ELEVE),
      'https://api.ecoledirecte.com/v3/Eleves/4242/cahierdetexte.awp?verbe=get&v=4.101.4',
      {},
    ],
    [
      'détail du jour',
      (subject) => subject.dayContent(ELEVE, '2026-09-08'),
      'https://api.ecoledirecte.com/v3/Eleves/4242/cahierdetexte/2026-09-08.awp?verbe=get&v=4.101.4',
      {},
    ],
    [
      'notes',
      (subject) => subject.grades(ELEVE),
      'https://api.ecoledirecte.com/v3/eleves/4242/notes.awp?verbe=get&v=4.101.4',
      { anneeScolaire: '' },
    ],
    [
      'vie scolaire',
      (subject) => subject.schoolLife(ELEVE),
      'https://api.ecoledirecte.com/v3/eleves/4242/viescolaire.awp?verbe=get&v=4.101.4',
      {},
    ],
    [
      'documents',
      (subject) => subject.documents(ELEVE),
      'https://api.ecoledirecte.com/v3/elevesDocuments.awp?verbe=get&v=4.101.4',
      { anneeScolaire: '', idEleve: '4242' },
    ],
    [
      'actualités',
      (subject) => subject.news(ELEVE),
      'https://api.ecoledirecte.com/v3/E/4242/viedeletablissement.awp?verbe=get&v=4.101.4',
      {},
    ],
    [
      'manuels',
      (subject) => subject.textbooks(ELEVE),
      'https://api.ecoledirecte.com/v3/E/4242/manuelsnumeriques.awp?verbe=get&v=4.101.4',
      {},
    ],
    [
      'stockage',
      (subject) => subject.cloud(ELEVE),
      'https://api.ecoledirecte.com/v3/eleves/4242/cloud.awp?verbe=get&v=4.101.4',
      {},
    ],
  ]

  for (const [nom, appel, url, corps] of cas) {
    it(nom, async () => {
      const { api: subject, engine } = api()
      await appel(subject)
      expect(engine.requests[0]?.url).toBe(url)
      expect(engine.sentBody(0)).toEqual(corps)
      // Toutes les requêtes sont des POST : le verbe réel voyage dans `verbe=`.
      expect(engine.requests[0]?.method).toBe('POST')
      expect(engine.requests[0]?.headers['X-Token']).toBe('JETON')
    })
  }
})

describe('messagerie', () => {
  it('demande la page du dossier voulu', async () => {
    const { api: subject, engine } = api()
    await subject.messages(ELEVE, { folder: 'sent', page: 2 })
    const url = new URL(engine.requests[0]?.url ?? '')
    expect(url.pathname).toBe('/v3/eleves/4242/messages.awp')
    expect(url.searchParams.get('typeRecuperation')).toBe('sent')
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.get('itemsPerPage')).toBe('50')
    expect(url.searchParams.get('orderBy')).toBe('date')
  })

  it('adresse la boîte de la famille pour un enfant consulté par un parent', async () => {
    const { api: subject, engine } = api()
    await subject.messages(ENFANT, { folder: 'received' })
    // C'est l'erreur qui fait répondre « accès refusé » à tous les appels d'un compte parent.
    expect(engine.requests[0]?.url).toContain('/v3/familles/99/messages.awp')
  })

  it('se place du bon côté selon le dossier', async () => {
    const { api: subject, engine } = api()
    await subject.messageDetail(ELEVE, '6001', 'received')
    await subject.messageDetail(ELEVE, '6002', 'sent')
    expect(engine.requests[0]?.url).toContain('mode=destinataire')
    expect(engine.requests[1]?.url).toContain('mode=expediteur')
  })
})

describe('écriture', () => {
  it('coche un devoir avec la forme exacte attendue', async () => {
    const { api: subject, engine } = api()
    await subject.setHomeworkDone(ELEVE, ['5001', '5002'], true)
    expect(engine.requests[0]?.url).toBe(
      'https://api.ecoledirecte.com/v3/Eleves/4242/cahierdetexte.awp?verbe=put&v=4.101.4',
    )
    // Les identifiants partent en nombres : une chaîne serait rejetée en silence.
    expect(engine.sentBody(0)).toEqual({ idDevoirsEffectues: [5001, 5002], idDevoirsNonEffectues: [] })
  })

  it('décoche dans l’autre liste', async () => {
    const { api: subject, engine } = api()
    await subject.setHomeworkDone(ELEVE, ['5001'], false)
    expect(engine.sentBody(0)).toEqual({ idDevoirsEffectues: [], idDevoirsNonEffectues: [5001] })
  })

  it('n’envoie rien quand il n’y a rien à envoyer', async () => {
    const { api: subject, engine } = api()
    const result = await subject.setHomeworkDone(ELEVE, [], true)
    expect(result.ok).toBe(true)
    expect(engine.requests).toHaveLength(0)
  })

  it('encode un commentaire en base64', async () => {
    const { api: subject, engine } = api()
    await subject.commentHomework(ELEVE, '900', 'Fini, mais je n’ai pas compris le 14.')
    const corps = engine.sentBody(0) as { message: string; idContenu: number }
    expect(Buffer.from(corps.message, 'base64').toString('utf8')).toBe('Fini, mais je n’ai pas compris le 14.')
    expect(corps.idContenu).toBe(900)
  })

  it('crée, renomme et supprime dans le stockage', async () => {
    const { api: subject, engine } = api()
    await subject.createCloudFolder(ELEVE, '0', 'Essais')
    await subject.renameCloudNode(ELEVE, 'f1', 'Cours.pdf')
    await subject.deleteCloudNodes(ELEVE, ['f1', 'f2'])
    expect(engine.requests[0]?.url).toContain('/v3/cloud/E/4242.awp?verbe=post')
    expect(engine.sentBody(0)).toEqual({ parentNode: { id: '0' }, libelle: 'Essais', typeRessource: 'folder' })
    expect(engine.requests[1]?.url).toContain('verbe=put')
    expect(engine.sentBody(1)).toEqual({ node: { id: 'f1' }, newLibelle: 'Cours.pdf' })
    expect(engine.requests[2]?.url).toContain('verbe=delete')
    expect(engine.sentBody(2)).toEqual({ tabNodes: [{ id: 'f1' }, { id: 'f2' }] })
  })

  it('toutes les écritures sont bloquées quand la police est fermée', async () => {
    const { api: subject, engine } = api('deny')
    const appels = [
      subject.setHomeworkDone(ELEVE, ['1'], true),
      subject.commentHomework(ELEVE, '1', 'x'),
      subject.createCloudFolder(ELEVE, '0', 'x'),
      subject.renameCloudNode(ELEVE, '1', 'x'),
      subject.deleteCloudNodes(ELEVE, ['1']),
    ]
    for (const resultat of await Promise.all(appels)) {
      expect(resultat.ok).toBe(false)
      expect(!resultat.ok && resultat.kind).toBe('write-disabled')
    }
    // Le vrai test : rien n'est sorti.
    expect(engine.requests).toHaveLength(0)
  })

  it('la lecture reste possible quand l’écriture est fermée', async () => {
    const { api: subject, engine } = api('deny')
    await subject.grades(ELEVE)
    expect(engine.requests).toHaveLength(1)
  })
})

describe('téléchargement', () => {
  it('vise telechargement.awp avec le type de fichier attendu', async () => {
    const engine = new FakeEngine([])
    let vue: { url: string; body?: string } | null = null
    const moteur = {
      ...engine,
      send: engine.send.bind(engine),
      download: async (request: { url: string; body?: string }) => {
        vue = request
        return { status: 200, headers: { 'content-type': ['application/pdf'] }, bytes: new Uint8Array([1, 2, 3]) }
      },
    }
    const client = new EcoleDirecteClient({ engine: moteur })
    client.session.token = 'JETON'
    const result = await new EcoleDirecteApi(client).download({
      id: '77',
      name: 'fiche.pdf',
      type: 'FICHIER_CDT',
      source: 'homework',
      downloadType: 'FICHIER_CDT',
    })

    expect(result.ok).toBe(true)
    expect(vue!.url).toBe(
      'https://api.ecoledirecte.com/v3/telechargement.awp?verbe=get&fichierId=77&leTypeDeFichier=FICHIER_CDT&v=4.101.4',
    )
    expect(vue!.body).toBe('data=%7B%22forceDownload%22%3A%200%7D')
  })

  it('reconnaît un refus déguisé en fichier', async () => {
    const moteur = {
      send: async () => ({ status: 200, headers: {}, body: '{}' }),
      // Le service répond parfois un petit JSON d'erreur là où on attend un PDF.
      download: async () => ({
        status: 200,
        headers: { 'content-type': ['application/json; charset=utf-8'] },
        bytes: new Uint8Array([123, 125]),
      }),
    }
    const client = new EcoleDirecteClient({ engine: moteur })
    const result = await new EcoleDirecteApi(client).download({
      id: '77',
      name: 'fiche.pdf',
      type: '',
      source: 'homework',
      downloadType: '',
    })
    expect(result.ok).toBe(false)
    expect(!result.ok && result.kind).toBe('access-denied')
  })
})
