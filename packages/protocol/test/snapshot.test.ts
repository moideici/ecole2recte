import { describe, expect, it } from 'vitest'
import { emptySnapshot, lastSyncedAt, mergeSnapshot } from '../src/snapshot.js'
import type { Account, Lesson } from '../src/models.js'

const COMPTE: Account = {
  id: '1',
  type: 'E',
  firstName: 'Camille',
  lastName: 'Durand',
  className: '',
  schoolName: '',
  modules: [],
}

function cours(id: string): Lesson {
  return {
    id,
    subject: 'Maths',
    teacher: '',
    room: '',
    start: '2026-09-07T08:00:00',
    end: '2026-09-07T09:00:00',
    canceled: false,
    exam: false,
    note: '',
    group: '',
    kind: '',
  }
}

describe('fusion d’instantanés', () => {
  it('ne remplace que ce qui a été rechargé', () => {
    const base = emptySnapshot(COMPTE)
    base.lessons = [cours('a')]
    base.syncedAt.timetable = 1000
    base.documents = [{ id: 'd1', name: 'x', category: 'y', type: 'z' }]
    base.syncedAt.documents = 1000

    const incoming = emptySnapshot(COMPTE)
    incoming.lessons = [cours('b')]
    incoming.syncedAt.timetable = 2000

    const fusion = mergeSnapshot(base, { snapshot: incoming, errors: {} })

    expect(fusion.lessons.map((entree) => entree.id)).toEqual(['b'])
    // Les documents n'étaient pas dans ce chargement : ils survivent.
    expect(fusion.documents).toHaveLength(1)
    expect(fusion.syncedAt).toEqual({ timetable: 2000, documents: 1000 })
  })

  it('n’efface pas une section qui a échoué', () => {
    const base = emptySnapshot(COMPTE)
    base.lessons = [cours('a')]
    base.syncedAt.timetable = 1000

    // Une section en échec ne porte pas d'horodatage : elle n'est donc pas fusionnée.
    const incoming = emptySnapshot(COMPTE)
    const fusion = mergeSnapshot(base, {
      snapshot: incoming,
      errors: { timetable: { ok: false, kind: 'network', message: 'injoignable' } },
    })

    expect(fusion.lessons.map((entree) => entree.id)).toEqual(['a'])
  })

  it('dit ce qui a vieilli le plus récemment', () => {
    const snapshot = emptySnapshot(COMPTE)
    expect(lastSyncedAt(snapshot)).toBeUndefined()
    snapshot.syncedAt.timetable = 10
    snapshot.syncedAt.grades = 30
    expect(lastSyncedAt(snapshot)).toBe(30)
  })
})
