import { beforeEach, describe, expect, it } from 'vitest'
import { env } from '$env/dynamic/private'
import type { Account } from '@ecole2recte/protocol'
import { peutEcrire } from './guard.js'
import type { SessionRecord } from './store.js'

/**
 * La garde d'écriture.
 *
 * C'est elle qui décide si un geste part chez ÉcoleDirecte. Trois verrous, et il les faut
 * tous : ils sont testés un par un, parce qu'en ouvrir un par accident se verrait dans le
 * dossier scolaire de quelqu'un.
 */
beforeEach(() => {
  delete env['ED_WRITE_POLICY']
  delete env['ED_WRITE_FEATURES']
})

function eleve(extra: Partial<Account> = {}): Account {
  return {
    id: '4021',
    type: 'E',
    firstName: 'Camille',
    lastName: 'Bernard',
    className: 'Première G2',
    schoolName: 'Lycée',
    modules: [],
    ...extra,
  }
}

function session(extra: Partial<SessionRecord> = {}): SessionRecord {
  return {
    protocol: {} as SessionRecord['protocol'],
    accounts: [],
    activeAccountId: '4021',
    awaitingSecurityAnswer: false,
    snapshots: {},
    createdAt: 0,
    touchedAt: 0,
    ...extra,
  }
}

function ouvrir(features: string) {
  env['ED_WRITE_POLICY'] = 'allow'
  env['ED_WRITE_FEATURES'] = features
}

describe('garde d’écriture', () => {
  it('laisse passer un élève quand la fonction est ouverte', () => {
    ouvrir('homework-done')
    const garde = { id: 's', record: session(), account: eleve() }
    expect(peutEcrire(garde, 'homework-done')).toBe(true)
    // Une fonction voisine, non déclarée, reste fermée.
    expect(peutEcrire(garde, 'cloud-delete')).toBe(false)
  })

  it('refuse depuis une vue parent, même la fonction ouverte', () => {
    ouvrir('all')
    // Cocher depuis le compte d'un parent enverrait un geste que l'enfant n'a pas fait.
    const garde = { id: 's', record: session(), account: eleve({ familyId: '9000' }) }
    expect(peutEcrire(garde, 'homework-done')).toBe(false)
  })

  it('refuse dans une démonstration, dont le moteur ne sait pas écrire', () => {
    ouvrir('all')
    // Proposer un bouton qui échoue à chaque clic est pire que ne rien proposer.
    const garde = { id: 's', record: session({ demo: true }), account: eleve() }
    expect(peutEcrire(garde, 'homework-done')).toBe(false)
  })

  it('refuse tout quand la police est fermée', () => {
    env['ED_WRITE_FEATURES'] = 'all'
    const garde = { id: 's', record: session(), account: eleve() }
    expect(peutEcrire(garde, 'homework-done')).toBe(false)
  })
})
