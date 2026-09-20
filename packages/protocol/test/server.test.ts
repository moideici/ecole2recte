import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { EcoleDirecteApi } from '../src/api.js'
import { EcoleDirecteClient } from '../src/client.js'
import { fetchEngine } from '../src/transport.js'
import { ALL_SECTIONS, syncSections } from '../src/snapshot.js'
import { type FakeServer, startFakeServer } from './server.js'
import type { Account } from '../src/models.js'

let serveur: FakeServer

beforeAll(async () => {
  serveur = await startFakeServer()
})

afterAll(async () => {
  await serveur.close()
})

function client(): EcoleDirecteClient {
  return new EcoleDirecteClient({ engine: fetchEngine(), apiBase: serveur.url, writePolicy: 'allow' })
}

describe('bout en bout, en vrai HTTP', () => {
  it('se connecte et lit tout', async () => {
    const subject = client()
    const outcome = await subject.login('camille', 'secret')
    expect(outcome.ok).toBe(true)

    const compte = (outcome as { accounts: Account[] }).accounts[0] as Account
    const { snapshot, errors } = await syncSections(new EcoleDirecteApi(subject), compte, {
      today: '2026-09-07',
      sections: ALL_SECTIONS,
    })

    expect(errors).toEqual({})
    expect(snapshot.lessons).toHaveLength(4)
    expect(snapshot.homework).toHaveLength(3)
    expect(snapshot.grades).toHaveLength(3)
    expect(snapshot.schoolLife).toHaveLength(3)
    expect(snapshot.messages).toHaveLength(1)
    expect(snapshot.documents).toHaveLength(2)
    expect(snapshot.news).toHaveLength(2)
    expect(snapshot.textbooks).toHaveLength(2)
    // Trois fichiers et les deux dossiers qui les portent : sans l'identifiant d'un dossier,
    // on ne pourrait rien y créer.
    expect(snapshot.cloudFiles.filter((entree) => entree.file)).toHaveLength(3)
    expect(snapshot.cloudFiles.filter((entree) => !entree.file)).toHaveLength(2)
    // Chaque section porte son propre horodatage.
    expect(Object.keys(snapshot.syncedAt).sort()).toEqual([...ALL_SECTIONS].sort())
  })

  it('rapporte les jetons et les deux cookies', async () => {
    const subject = client()
    await subject.login('camille', 'secret')
    expect(subject.session.token).toBe('JETON-FACTICE')
    expect(subject.session.twoFactorToken).toBe('JETON-2FA')
    // `headers.get` recollerait ces deux cookies en une seule chaîne et en perdrait un.
    expect(subject.session.cookies).toEqual({ GTK: 'GTK-FACTICE', SID: 'abc' })
  })

  it('renvoie le jeton et le User-Agent épinglé à chaque appel', async () => {
    const subject = client()
    await subject.login('camille', 'secret')
    serveur.requests.length = 0
    await new EcoleDirecteApi(subject).grades({
      id: '4242',
      type: 'E',
      firstName: '',
      lastName: '',
      className: '',
      schoolName: '',
      modules: [],
    })
    const vue = serveur.requests[0]
    expect(vue?.headers.token).toBe('JETON-FACTICE')
    // Le jeton est lié au User-Agent qui l'a obtenu : en changer l'invalide.
    expect(vue?.headers.agent).toBe(subject.session.userAgent)
    expect(vue?.headers.cookie).toContain('GTK=GTK-FACTICE')
    expect(vue?.body).toBe('data=%7B%22anneeScolaire%22%3A%20%22%22%7D')
  })
})

describe('une section qui tombe n’emporte pas les autres', () => {
  it('isole l’échec là où il se produit', async () => {
    const subject = client()
    const outcome = await subject.login('camille', 'secret')
    const compte = (outcome as { accounts: Account[] }).accounts[0] as Account

    // Un module fermé pour l'établissement, et un compte bloqué sur les notes. Deux refus
    // que le client ne rattrape pas — contrairement à un jeton expiré, voir plus bas.
    serveur.fail('cloud.awp', 403)
    serveur.fail('notes.awp', 516)

    const { snapshot, errors } = await syncSections(new EcoleDirecteApi(subject), compte, {
      today: '2026-09-07',
      sections: ALL_SECTIONS,
    })

    expect(errors.cloud?.kind).toBe('access-denied')
    expect(errors.grades?.kind).toBe('account-blocked')
    // L'emploi du temps reste consultable, et c'est tout l'intérêt.
    expect(snapshot.lessons).toHaveLength(4)
    expect(snapshot.syncedAt.timetable).toBeDefined()
    expect(snapshot.syncedAt.grades).toBeUndefined()
  })

  it('traverse un jeton expiré sans que la personne le voie', async () => {
    const subject = client()
    const outcome = await subject.login('camille', 'secret')
    const compte = (outcome as { accounts: Account[] }).accounts[0] as Account

    // Le jeton tourne à chaque requête, et une pause suffit à le périmer. Jusqu'ici cela se
    // voyait comme une déconnexion en pleine consultation ; il est maintenant renouvelé et
    // l'appel rejoué, une seule fois.
    serveur.fail('notes.awp', 525)
    serveur.requests.length = 0

    const { snapshot, errors } = await syncSections(new EcoleDirecteApi(subject), compte, {
      today: '2026-09-07',
      sections: ['grades'],
    })

    expect(errors.grades).toBeUndefined()
    expect(snapshot.periods).toHaveLength(2)
    // Un renouvellement, et deux passages sur les notes : jamais un troisième.
    expect(serveur.requests.filter((requete) => requete.path.includes('renewtoken')).length).toBe(1)
    expect(serveur.requests.filter((requete) => requete.path.includes('notes.awp')).length).toBe(2)
  })

  it('traduit une version périmée en message qui dit quoi faire', async () => {
    const subject = client()
    // `login.awp?v=` vise la connexion et non l'appel GTK, qui partage le même chemin.
    serveur.fail('login.awp?v=', 517)
    const outcome = await subject.login('camille', 'secret')
    expect(outcome.ok).toBe(false)
    expect(!outcome.ok && outcome.kind).toBe('stale-version')
  })

  it('dit la vraie cause quand c’est l’appel GTK qui tombe', async () => {
    // Annoncer « jeton GTK absent » sur un 517 enverrait chercher au mauvais endroit.
    const subject = client()
    serveur.fail('gtk=1', 517)
    const outcome = await subject.login('camille', 'secret')
    expect(!outcome.ok && outcome.kind).toBe('stale-version')
  })
})
