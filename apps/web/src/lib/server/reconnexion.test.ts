import { beforeEach, describe, expect, it, vi } from 'vitest'
import { env } from '$env/dynamic/private'
import type { Account } from '@ecole2recte/protocol'
import {
  DELAI_GARDE_MS,
  FENETRE_MS,
  PLAFOND,
  reconnecteur,
  reconnexionDisponible,
  retenirIdentifiants,
} from './reconnexion.js'
import type { SessionRecord } from './store.js'

/*
 * Ce qui est éprouvé ici n'est pas « se reconnecter marche » — une connexion, on sait qu'elle
 * marche, c'est ce qui arrive tous les jours. C'est **combien de fois** elle part.
 *
 * Un compte réel a été bloqué par ÉcoleDirecte après quelques connexions rapprochées. Une
 * page charge sept sections en parallèle : sur un jeton mort, les sept échouent à la même
 * seconde. Sans verrou, ce serait sept connexions d'un coup — le geste exact qui bloque.
 */

const connexions = vi.hoisted(() => ({ compte: 0, resultat: { ok: true, accounts: [] as Account[] } as unknown }))
const ecritures = vi.hoisted(() => ({ compte: 0 }))

vi.mock('@ecole2recte/protocol', async (original) => {
  const vrai = await original<typeof import('@ecole2recte/protocol')>()
  return {
    ...vrai,
    fetchEngine: () => ({ send: async () => ({ status: 200, headers: {}, body: '{}' }) }),
    EcoleDirecteClient: class {
      session = vrai.createSession({ token: 'NEUF' })
      async login() {
        connexions.compte += 1
        // Deux sections qui partent ensemble doivent se retrouver sur la même promesse :
        // un appel instantané ne prouverait rien.
        await new Promise((suite) => setTimeout(suite, 10))
        return connexions.resultat
      }
    },
  }
})

vi.mock('./store.js', async (original) => {
  const vrai = await original<typeof import('./store.js')>()
  return { ...vrai, sessions: { write: async () => { ecritures.compte += 1 }, read: async () => null, create: async () => 'x', destroy: async () => {} } }
})

function dossier(): SessionRecord {
  return {
    protocol: { gtk: null, token: 'MORT', twoFactorToken: null, cookies: {}, userAgent: 'UA', apiVersion: '4.101.4' },
    accounts: [],
    activeAccountId: null,
    awaitingSecurityAnswer: false,
    snapshots: {},
    remembered: retenirIdentifiants('camille', 'secret'),
    createdAt: Date.now(),
    touchedAt: Date.now(),
  }
}

beforeEach(() => {
  env['SESSION_SECRET'] = 'une-clef-de-test-assez-longue'
  delete env['ED_REMEMBER']
  connexions.compte = 0
  connexions.resultat = { ok: true, accounts: [] }
  ecritures.compte = 0
})

describe('ce qu’on garde', () => {
  it('ne garde rien sans vrai secret', () => {
    // `seal()` accepte en développement une clé dérivée d'une chaîne fixe : bon pour un
    // couple `cn`/`cv`, pas pour un mot de passe. Sans secret, on ne garde rien du tout.
    delete env['SESSION_SECRET']
    expect(reconnexionDisponible()).toBe(false)
    expect(retenirIdentifiants('camille', 'secret')).toBeUndefined()
  })

  it('se coupe d’un mot sans redéployer', () => {
    env['ED_REMEMBER'] = '0'
    expect(reconnexionDisponible()).toBe(false)
  })

  it('ne garde jamais le mot de passe en clair', () => {
    const scelle = retenirIdentifiants('camille', 'secret') ?? ''
    expect(scelle).not.toContain('secret')
    expect(scelle).not.toContain('camille')
  })

  it('ne rouvre pas une démonstration, ni une session sans rien de gardé', () => {
    expect(reconnecteur('s1', { ...dossier(), demo: true })).toBeUndefined()
    const sans = dossier()
    delete sans.remembered
    expect(reconnecteur('s1', sans)).toBeUndefined()
  })
})

describe('jamais une rafale', () => {
  it('sept sections qui échouent ensemble ne font qu’une connexion', async () => {
    // Le cas réel : `syncSections` lance tout en parallèle.
    const rouvrir = reconnecteur('s1', dossier())
    const resultats = await Promise.all(Array.from({ length: 7 }, () => rouvrir?.()))

    expect(resultats.every((abouti) => abouti === true)).toBe(true)
    expect(connexions.compte).toBe(1)
  })

  it('ne repart pas dans la minute qui suit', async () => {
    const record = dossier()
    record.reauth = { at: Date.now(), count: 1 }
    expect(await reconnecteur('s1', record)?.()).toBe(false)
    expect(connexions.compte).toBe(0)
  })

  it('repart une fois le délai de garde passé', async () => {
    const record = dossier()
    record.reauth = { at: Date.now() - DELAI_GARDE_MS - 1, count: 1 }
    expect(await reconnecteur('s1', record)?.()).toBe(true)
    expect(connexions.compte).toBe(1)
  })

  it('s’arrête au plafond', async () => {
    const record = dossier()
    record.reauth = { at: Date.now() - DELAI_GARDE_MS - 1, count: PLAFOND }
    expect(await reconnecteur('s1', record)?.()).toBe(false)
    expect(connexions.compte).toBe(0)
  })

  it('le plafond glisse : une heure calme le remet à zéro', async () => {
    /*
     * Sans cela, une session « rester connecté » — qui vit des semaines tant qu'on s'en
     * sert — finirait par atteindre huit reconnexions en quelques jours d'usage normal, et
     * renverrait au mot de passe sans qu'il se soit rien passé d'anormal.
     */
    const record = dossier()
    record.reauth = { at: Date.now() - FENETRE_MS - 1, count: PLAFOND }
    expect(await reconnecteur('s1', record)?.()).toBe(true)
    expect(record.reauth?.count).toBe(1)
  })

  it('compte la tentative avant de la faire', async () => {
    // Si l'appel n'aboutit jamais, le délai de garde doit avoir couru quand même : sinon la
    // section suivante repartirait aussitôt, et on serait revenu à la rafale.
    const record = dossier()
    await reconnecteur('s1', record)?.()
    expect(record.reauth?.count).toBe(1)
    expect(record.reauth?.at).toBeGreaterThan(0)
  })
})

describe('un mot de passe refusé', () => {
  it('s’oublie au lieu de se rejouer', async () => {
    // Rejouer un mot de passe faux est la façon la plus sûre de faire bloquer un compte.
    connexions.resultat = { ok: false, kind: 'invalid-credentials', message: 'non' }
    const record = dossier()
    expect(await reconnecteur('s1', record)?.()).toBe(false)
    expect(record.remembered).toBeUndefined()
    expect(reconnecteur('s1', record)).toBeUndefined()
  })

  it('s’oublie aussi si le service repose sa question', async () => {
    // Personne n'est là pour y répondre : insister ne ferait qu'ajouter des connexions.
    connexions.resultat = { ok: false, kind: 'two-factor', message: 'question' }
    const record = dossier()
    expect(await reconnecteur('s1', record)?.()).toBe(false)
    expect(record.remembered).toBeUndefined()
  })

  it('garde ce qu’il faut si c’est le service qui est en panne', async () => {
    // Une panne passagère n'est pas un mot de passe faux : on retentera plus tard.
    connexions.resultat = { ok: false, kind: 'server', message: 'en panne' }
    const record = dossier()
    expect(await reconnecteur('s1', record)?.()).toBe(false)
    expect(record.remembered).toBeDefined()
  })
})
