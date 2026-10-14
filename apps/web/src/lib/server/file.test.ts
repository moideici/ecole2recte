import { describe, expect, it, vi } from 'vitest'
import { ATTENTE_MAX_MS, enFile } from './file.js'

const pause = (ms: number) => new Promise((suite) => setTimeout(suite, ms))

describe('une requête à la fois par session', () => {
  it('met en file deux requêtes de la même session', async () => {
    const journal: string[] = []
    const tache = (nom: string, ms: number) => async () => {
      journal.push(`${nom}>`)
      await pause(ms)
      journal.push(`<${nom}`)
    }
    await Promise.all([enFile('s', tache('a', 20)), enFile('s', tache('b', 1))])
    expect(journal).toEqual(['a>', '<a', 'b>', '<b'])
  })

  it('ne retient pas les autres sessions', async () => {
    const journal: string[] = []
    await Promise.all([
      enFile('x', async () => { await pause(20); journal.push('x') }),
      enFile('y', async () => { journal.push('y') }),
    ])
    expect(journal).toEqual(['y', 'x'])
  })

  it('une tâche qui échoue libère la suivante', async () => {
    const premiere = enFile('z', async () => { throw new Error('non') })
    await expect(premiere).rejects.toThrow('non')
    expect(await enFile('z', async () => 'ok')).toBe('ok')
  })

  it('n’attend pas indéfiniment une requête bloquée', async () => {
    vi.useFakeTimers()
    try {
      void enFile('b', () => new Promise(() => {}))
      const suivante = enFile('b', async () => 'passée')
      await vi.advanceTimersByTimeAsync(ATTENTE_MAX_MS + 1)
      expect(await suivante).toBe('passée')
    } finally {
      vi.useRealTimers()
    }
  })
})
