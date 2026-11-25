import { describe, expect, it } from 'vitest'
import {
  ATTENTE_PAR_DEFAUT_MS, BLOCAGE_PAR_DEFAUT_MS, QUESTION_MS, avecReessais, lirePause, messagePause, pauseActive,
  pauseApres, poserPause, reessais,
} from './pause.js'

const echec = (kind: string, extra: object = {}) => ({ ok: false as const, kind: kind as never, message: 'm', ...extra })
const maintenant = Date.parse('2026-11-25T10:00:00Z')

describe('la pause qui suit un refus', () => {
  it('demande de patienter : la durée du service, au moins une minute', () => {
    expect(pauseApres(echec('rate-limited', { retryAfterMs: 120_000 }), maintenant)).toEqual({ jusqua: maintenant + 120_000, raison: 'attente' })
    expect(pauseApres(echec('rate-limited'), maintenant)?.jusqua).toBe(maintenant + ATTENTE_PAR_DEFAUT_MS)
    expect(pauseApres(echec('rate-limited', { retryAfterMs: 1000 }), maintenant)?.jusqua).toBe(maintenant + 60_000)
  })

  it('adresse refusée ou compte bloqué : une demi-heure par défaut', () => {
    for (const kind of ['ip-blocked', 'account-blocked']) {
      expect(pauseApres(echec(kind), maintenant)).toEqual({ jusqua: maintenant + BLOCAGE_PAR_DEFAUT_MS, raison: 'blocage' })
    }
  })

  it('question de sécurité : une pause qui attend une personne, pas un délai', () => {
    expect(pauseApres(echec('two-factor'), maintenant)).toEqual({ jusqua: maintenant + QUESTION_MS, raison: 'question' })
  })

  it('pas de pause pour le reste : identifiants refusés, panne passagère, version périmée', () => {
    for (const kind of ['invalid-credentials', 'network', 'stale-version', 'protocol', 'session-expired']) {
      expect(pauseApres(echec(kind), maintenant)).toBeNull()
    }
  })

  it('n’est active que tant que l’heure n’est pas passée', () => {
    const pause = { jusqua: maintenant + 1000, raison: 'blocage' as const }
    expect(pauseActive(pause, maintenant)).toBe(true)
    expect(pauseActive(pause, maintenant + 1000)).toBe(false)
    expect(pauseActive(undefined)).toBe(false)
  })
})

describe('le message', () => {
  const pause = { jusqua: Date.parse('2026-11-25T14:30:00Z'), raison: 'blocage' as const }

  it('adresse refusée : parle du VPN, de l’e-mail d’autorisation et de l’heure de nouvel essai', () => {
    const texte = messagePause(pause)
    expect(texte).toMatch(/VPN/)
    expect(texte).toMatch(/mail/)
    expect(texte).toMatch(/15:30/) // heure de Paris
  })

  it('attente et question ont chacune leur message', () => {
    expect(messagePause({ ...pause, raison: 'attente' })).toMatch(/patienter/)
    expect(messagePause({ ...pause, raison: 'question' })).toMatch(/à la main/)
  })

  it('ne suggère jamais de contourner : pas de proxy, pas de changement d’adresse forcé', () => {
    for (const raison of ['attente', 'blocage', 'question'] as const) {
      expect(messagePause({ ...pause, raison })).not.toMatch(/proxy|contourn|forcer/i)
    }
  })
})

describe('le cookie de pause', () => {
  class Jar {
    valeurs = new Map<string, string>()
    get = (n: string) => this.valeurs.get(n)
    set = (n: string, v: string) => void this.valeurs.set(n, v)
  }

  it('fait l’aller-retour tant que la pause dure, puis s’éteint', () => {
    const jar = new Jar()
    poserPause(jar as never, { jusqua: maintenant + 60_000, raison: 'blocage' }, true, maintenant)
    expect(lirePause(jar, maintenant)).toEqual({ jusqua: maintenant + 60_000, raison: 'blocage' })
    expect(lirePause(jar, maintenant + 61_000)).toBeNull()
  })

  it('ne retient pas la question : la page de connexion est précisément l’endroit où la résoudre', () => {
    const jar = new Jar()
    poserPause(jar as never, { jusqua: maintenant + QUESTION_MS, raison: 'question' }, true, maintenant)
    expect(jar.valeurs.size).toBe(0)
  })

  it('ignore un cookie illisible ou falsifié', () => {
    const jar = new Jar()
    for (const brut of ['', 'abc', '123.inconnue', 'NaN.blocage']) {
      jar.valeurs.set('e2r_pause', brut)
      expect(lirePause(jar, maintenant)).toBeNull()
    }
  })
})

describe('les réessais', () => {
  const attentes: number[] = []
  const reglage = () => {
    attentes.length = 0
    reessais.dormir = async (ms) => void attentes.push(ms)
    reessais.alea = () => 0
  }

  it('ne rejoue que les pannes passagères', async () => {
    reglage()
    for (const kind of ['invalid-credentials', 'ip-blocked', 'rate-limited', 'two-factor', 'account-blocked', 'protocol']) {
      let appels = 0
      await avecReessais(async () => { appels++; return echec(kind) })
      expect(appels, kind).toBe(1)
    }
    expect(attentes).toEqual([])
  })

  it('rejoue une panne réseau, avec une attente qui double, trois essais au plus', async () => {
    reglage()
    let appels = 0
    const issue = await avecReessais(async () => { appels++; return echec('network') })
    expect(issue.ok).toBe(false)
    expect(appels).toBe(3)
    expect(attentes).toEqual([800, 1600])
  })

  it('s’arrête dès que ça passe', async () => {
    reglage()
    let appels = 0
    const issue = await avecReessais(async () => { appels++; return appels < 2 ? echec('network') : { ok: true as const } })
    expect(issue.ok).toBe(true)
    expect(appels).toBe(2)
  })

  it('ajoute un peu d’aléa pour que deux requêtes ne repartent pas ensemble', async () => {
    reglage()
    reessais.alea = () => 1
    await avecReessais(async () => echec('network'))
    expect(attentes).toEqual([1000, 2000])
  })
})
