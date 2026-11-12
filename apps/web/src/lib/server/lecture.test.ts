import { expect, it } from 'vitest'
import { lecture, observerLecture } from './lecture.js'

it('isole les dates et les causes de deux requêtes concurrentes', async () => {
  const premier = { causes: [] as string[], dates: [] as number[] }
  const second = { causes: [] as string[], dates: [] as number[] }
  await Promise.all([
    lecture.run(premier, async () => {
      await Promise.resolve()
      observerLecture(10, 'stale-version')
    }),
    lecture.run(second, async () => {
      observerLecture(20)
      await Promise.resolve()
      observerLecture(30, 'account-blocked')
    }),
  ])
  expect(premier).toEqual({ dates: [10], causes: ['stale-version'] })
  expect(second).toEqual({ dates: [20, 30], causes: ['account-blocked'] })
  expect(() => observerLecture(40)).not.toThrow()
})
