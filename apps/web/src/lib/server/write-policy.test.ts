import { beforeEach, describe, expect, it } from 'vitest'
import { env } from '$env/dynamic/private'
import { autoRenewEnabled, enabledWriteFeatures, isWriteEnabled, writePolicy } from './write-policy.js'

beforeEach(() => {
  delete env['ED_WRITE_POLICY']
  delete env['ED_WRITE_FEATURES']
  delete env['ED_AUTO_RENEW']
})

describe('renouvellement du jeton', () => {
  it('est fermé sans configuration', () => {
    // Le service a répondu à `renewtoken.awp` par son message d'activité suspecte : tant que
    // sa forme n'est pas éprouvée, on ne l'appelle pas au nom de quelqu'un.
    expect(autoRenewEnabled()).toBe(false)
  })

  it('ne s’ouvre que sur un oui franc', () => {
    env['ED_AUTO_RENEW'] = 'oui'
    expect(autoRenewEnabled()).toBe(false)
    env['ED_AUTO_RENEW'] = '0'
    expect(autoRenewEnabled()).toBe(false)
    env['ED_AUTO_RENEW'] = '1'
    expect(autoRenewEnabled()).toBe(true)
  })
})

describe('police d’écriture', () => {
  it('est fermée sans configuration', () => {
    // Le défaut n'est pas de la prudence décorative : rendre un devoir est irréversible.
    expect(writePolicy()).toBe('deny')
    expect(isWriteEnabled('homework-done')).toBe(false)
    expect(enabledWriteFeatures()).toEqual([])
  })

  it('refuse une valeur inconnue plutôt que de l’interpréter', () => {
    env['ED_WRITE_POLICY'] = 'oui'
    expect(writePolicy()).toBe('deny')
  })

  it('exige les deux verrous', () => {
    env['ED_WRITE_POLICY'] = 'allow'
    // Police ouverte mais aucune fonction déclarée : rien ne passe.
    expect(isWriteEnabled('homework-done')).toBe(false)

    env['ED_WRITE_FEATURES'] = 'homework-done'
    expect(isWriteEnabled('homework-done')).toBe(true)
    expect(isWriteEnabled('cloud-delete')).toBe(false)
  })

  it('ferme tout dès que la police se referme', () => {
    env['ED_WRITE_FEATURES'] = 'all'
    env['ED_WRITE_POLICY'] = 'deny'
    expect(isWriteEnabled('cloud-delete')).toBe(false)
  })

  it('tolère les espaces et la casse dans la liste', () => {
    env['ED_WRITE_POLICY'] = 'dry-run'
    env['ED_WRITE_FEATURES'] = ' Homework-Done ,, cloud-folder '
    expect(enabledWriteFeatures().sort()).toEqual(['cloud-folder', 'homework-done'])
  })
})
