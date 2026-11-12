import { beforeEach, describe, expect, it, vi } from 'vitest'
import { env } from '$env/dynamic/private'
import { parseAccounts } from '@ecole2recte/protocol'
import { DEMO_STUDENT_LOGIN } from './demo.js'
import { COOKIE_APPAREIL, etatCoffre, oublierAppareil, retenirAppareil, rouvrirDepuisCoffre } from './appareil.js'
import { DELAI_GARDE_MS, retenirIdentifiants } from './reconnexion.js'
import { COOKIE_NAME } from './session.js'
import { sessions, type SessionRecord } from './store.js'
import { ajouterAuJournal, JOURNAL_MAX, pageSansValeur } from './journal.js'
import { sessionSecret } from './secret.js'

/*
 * Ce qu'on éprouve ici : le jour où la session disparaît, l'appareil reconnu rouvre tout seul —
 * sans mot de passe, sans question de sécurité — **et** sans jamais se reconnecter en rafale.
 * Le magasin est le vrai (en mémoire) : seule la connexion à ÉcoleDirecte est simulée.
 */

const service = vi.hoisted(() => ({
  appels: [] as Array<{ identifier: string; password: string; trusted: unknown }>,
  issue: { ok: true } as unknown,
}))

vi.mock('@ecole2recte/protocol', async (original) => {
  const vrai = await original<typeof import('@ecole2recte/protocol')>()
  return {
    ...vrai,
    fetchEngine: () => ({ send: async () => ({ status: 200, headers: {}, body: '{}' }) }),
    EcoleDirecteClient: class {
      session = vrai.createSession({ token: 'NEUF' })
      async login(identifier: string, password: string, trusted: unknown) {
        service.appels.push({ identifier, password, trusted })
        // Les requêtes d'une même page partent ensemble : un appel instantané ne prouverait rien.
        await new Promise((suite) => setTimeout(suite, 15))
        return service.issue
      }
    },
  }
})

class Cookies {
  private readonly valeurs = new Map<string, string>()
  get = (nom: string) => this.valeurs.get(nom)
  set = (nom: string, valeur: string) => void this.valeurs.set(nom, valeur)
  delete = (nom: string) => void this.valeurs.delete(nom)
}

const url = new URL('https://ecole.test/')
const comptes = parseAccounts(DEMO_STUDENT_LOGIN)
const confiance = { cn: 'CN-DE-TEST', cv: 'CV-DE-TEST' }

function jar(): Cookies & { get: (n: string) => string | undefined } {
  return new Cookies()
}

async function appareilRetenu(cookies: Cookies) {
  const scelle = retenirIdentifiants('camille', 'mot-de-passe-de-test')
  const id = await retenirAppareil(cookies as never, url, scelle, confiance)
  return { id: id as string, scelle: scelle as string }
}

beforeEach(() => {
  env['SESSION_SECRET'] = 'une-clef-de-test-assez-longue'
  delete env['ED_REMEMBER']
  service.appels = []
  service.issue = { ok: true, accounts: comptes }
})

describe('retenir l’appareil', () => {
  it('garde les identifiants scellés et le couple de confiance, jamais en clair', async () => {
    const cookies = jar()
    const { id, scelle } = await appareilRetenu(cookies)
    expect(cookies.get(COOKIE_APPAREIL)).toBe(id)
    const coffre = await sessions.read(id)
    expect(coffre?.coffre).toBe(true)
    expect(coffre?.remembered).toBe(scelle)
    expect(coffre?.trusted).toEqual(confiance)
    expect(JSON.stringify(coffre)).not.toContain('mot-de-passe-de-test')
    expect(JSON.stringify(coffre)).not.toContain('camille')
  })

  it('met à jour le même coffre à la connexion suivante, sans en créer un second', async () => {
    const cookies = jar()
    const premier = await appareilRetenu(cookies)
    const second = await appareilRetenu(cookies)
    expect(second.id).toBe(premier.id)
  })

  it('oublie l’appareil quand « Rester connecté » est décoché', async () => {
    const cookies = jar()
    const { id } = await appareilRetenu(cookies)
    expect(await retenirAppareil(cookies as never, url, undefined)).toBeUndefined()
    expect(await sessions.read(id)).toBeNull()
    expect(cookies.get(COOKIE_APPAREIL)).toBeUndefined()
  })

  it('se déconnecter vide le coffre et le cookie', async () => {
    const cookies = jar()
    const { id } = await appareilRetenu(cookies)
    await oublierAppareil(cookies as never)
    expect(await sessions.read(id)).toBeNull()
    expect(cookies.get(COOKIE_APPAREIL)).toBeUndefined()
  })
})

describe('rouvrir une session perdue', () => {
  it('rouvre sans question : le couple de confiance est rejoué avec les identifiants', async () => {
    const cookies = jar()
    await appareilRetenu(cookies)
    const ouverte = await rouvrirDepuisCoffre(cookies as never, url)
    expect(ouverte?.record.accounts.length).toBeGreaterThan(0)
    expect(service.appels).toEqual([{ identifier: 'camille', password: 'mot-de-passe-de-test', trusted: confiance }])
    expect(cookies.get(COOKIE_NAME)).toBe(ouverte?.id)
    expect(ouverte?.record.remembered).toBeDefined()
    expect(ouverte?.record.appareil).toBe(cookies.get(COOKIE_APPAREIL))
  })

  it('cinq requêtes d’une même page ne font qu’une seule connexion', async () => {
    const cookies = jar()
    await appareilRetenu(cookies)
    const resultats = await Promise.all(Array.from({ length: 5 }, () => rouvrirDepuisCoffre(cookies as never, url)))
    expect(service.appels).toHaveLength(1)
    expect(new Set(resultats.map((r) => r?.id)).size).toBe(1)
  })

  it('réutilise la session qui vient d’être ouverte plutôt que d’en ouvrir une autre', async () => {
    const cookies = jar()
    await appareilRetenu(cookies)
    const premiere = await rouvrirDepuisCoffre(cookies as never, url)
    // Une requête arrivée juste après, sans le nouveau cookie encore reçu du navigateur.
    const suivante = await rouvrirDepuisCoffre(cookies as never, url)
    expect(suivante?.id).toBe(premiere?.id)
    expect(service.appels).toHaveLength(1)
  })

  it('respecte le délai de garde : pas de deuxième connexion dans la minute', async () => {
    const cookies = jar()
    const { id } = await appareilRetenu(cookies)
    await rouvrirDepuisCoffre(cookies as never, url)
    // On oublie la session ouverte (elle a « disparu »), mais le coffre se souvient de l'heure.
    const coffre = await sessions.read(id)
    delete coffre?.derniere
    await sessions.write(id, coffre!)
    expect(await rouvrirDepuisCoffre(cookies as never, url)).toBeNull()
    expect(service.appels).toHaveLength(1)
    expect(DELAI_GARDE_MS).toBe(60_000)
  })

  it('un mot de passe refusé vide le coffre : une tentative, pas de boucle', async () => {
    const cookies = jar()
    const { id } = await appareilRetenu(cookies)
    service.issue = { ok: false, kind: 'invalid-credentials', message: 'refusé' }
    expect(await rouvrirDepuisCoffre(cookies as never, url)).toBeNull()
    expect(await sessions.read(id)).toBeNull()
    expect(cookies.get(COOKIE_APPAREIL)).toBeUndefined()
    // Cookie parti : la requête suivante ne rejoue rien du tout.
    expect(await rouvrirDepuisCoffre(cookies as never, url)).toBeNull()
    expect(service.appels).toHaveLength(1)
  })

  it('une vérification demandée à la main (deux facteurs) vide aussi le coffre', async () => {
    const cookies = jar()
    const { id } = await appareilRetenu(cookies)
    service.issue = { ok: false, kind: 'two-factor', message: 'question' }
    expect(await rouvrirDepuisCoffre(cookies as never, url)).toBeNull()
    expect(await sessions.read(id)).toBeNull()
  })

  it('une panne du service laisse le coffre intact : on réessaiera plus tard', async () => {
    const cookies = jar()
    const { id } = await appareilRetenu(cookies)
    service.issue = { ok: false, kind: 'network', message: 'injoignable' }
    expect(await rouvrirDepuisCoffre(cookies as never, url)).toBeNull()
    expect((await sessions.read(id))?.coffre).toBe(true)
    expect(cookies.get(COOKIE_APPAREIL)).toBe(id)
  })

  it('ne fait rien quand la fonction est coupée (ED_REMEMBER=0)', async () => {
    const cookies = jar()
    await appareilRetenu(cookies)
    env['ED_REMEMBER'] = '0'
    expect(await rouvrirDepuisCoffre(cookies as never, url)).toBeNull()
    expect(service.appels).toHaveLength(0)
  })

  it('oublie un coffre dont le sceau est illisible (clé changée), sans rien envoyer', async () => {
    const cookies = jar()
    const { id } = await appareilRetenu(cookies)
    env['SESSION_SECRET'] = 'une-toute-autre-clef-de-test'
    expect(await rouvrirDepuisCoffre(cookies as never, url)).toBeNull()
    expect(await sessions.read(id)).toBeNull()
    expect(service.appels).toHaveLength(0)
  })

  it('ne fait rien sans cookie d’appareil', async () => {
    expect(await rouvrirDepuisCoffre(jar() as never, url)).toBeNull()
    expect(service.appels).toHaveLength(0)
  })

  it('montre l’état du coffre à Réglages', async () => {
    const cookies = jar()
    await appareilRetenu(cookies)
    const ouverte = await rouvrirDepuisCoffre(cookies as never, url)
    const etat = await etatCoffre(ouverte!.record)
    expect(etat.present).toBe(true)
    expect(etat.derniere).toBeGreaterThan(0)
    expect(await etatCoffre({ ...ouverte!.record, appareil: undefined })).toEqual({ present: false, derniere: null, expireLe: null })
  })
})

describe('le journal des chargements', () => {
  const base: SessionRecord = { protocol: {} as never, accounts: [], activeAccountId: null, awaitingSecurityAnswer: false, snapshots: {}, createdAt: 0, touchedAt: 0 }

  it('ne garde que la forme d’une page, jamais une date ni un identifiant', () => {
    expect(pageSansValeur('/devoirs/2026-11-12')).toBe('/devoirs/…')
    expect(pageSansValeur('/messages/48213')).toBe('/messages/…')
    expect(pageSansValeur('/notes')).toBe('/notes')
    expect(pageSansValeur('/')).toBe('/')
  })

  it('garde les trente dernières entrées', () => {
    const record = { ...base }
    for (let i = 0; i < 45; i++) ajouterAuJournal(record, { at: i, ms: 5, page: '/notes', resultat: 'ok' })
    expect(record.journal).toHaveLength(JOURNAL_MAX)
    expect(record.journal?.[0]?.at).toBe(15)
    expect(record.journal?.at(-1)?.at).toBe(44)
  })
})

describe('le secret', () => {
  it('sans SESSION_SECRET, et hors développement, on ne garde rien', () => {
    delete env['SESSION_SECRET']
    expect(sessionSecret()).toBeUndefined()
  })
})
