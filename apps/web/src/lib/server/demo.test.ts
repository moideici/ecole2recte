import { describe, expect, it } from 'vitest'
import {
  EcoleDirecteApi,
  EcoleDirecteClient,
  createSession,
  generalAverage,
  parseAccounts,
  reconcileSubjectAverages,
} from '@ecole2recte/protocol'
import { DEMO_STUDENT_LOGIN, demoEngine } from './demo.js'

/**
 * La démonstration élève, de bout en bout.
 *
 * Elle traverse la même chaîne que le réel — faux serveur, client, lecteur, arbitrage des
 * moyennes — et vérifie qu'elle montre bien ce qu'elle prétend montrer. Une démonstration
 * qui ne prouve rien finirait par illustrer un comportement disparu.
 *
 * La date est fixée : sans elle, le résultat dépendrait du jour où le test tourne.
 */
const JOUR = '2026-09-20'
const PERIODE = 'A001'

async function releve() {
  const account = parseAccounts(DEMO_STUDENT_LOGIN)[0]
  expect(account).toBeDefined()
  const client = new EcoleDirecteClient({
    engine: demoEngine(JOUR),
    session: createSession(),
    writePolicy: 'deny',
  })
  const result = await new EcoleDirecteApi(client).grades(account as never)
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.message)
  return result.value
}

describe('espace élève de démonstration', () => {
  it('montre un cours annulé et les anciennes valeurs d’un cours déplacé', async () => {
    const account = parseAccounts(DEMO_STUDENT_LOGIN)[0]
    const client = new EcoleDirecteClient({ engine: demoEngine('2026-11-12'), session: createSession(), writePolicy: 'deny' })
    const result = await new EcoleDirecteApi(client).timetable(account as never, '2026-11-09', '2026-11-14')
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.message)
    expect(result.value.some((cours) => cours.canceled)).toBe(true)
    expect(result.value.some((cours) => cours.previousStart && cours.previousRoom)).toBe(true)
  })
  it('sert un relevé lisible par les vrais lecteurs', async () => {
    const { periods, grades, subjectAverages } = await releve()
    expect(periods.map((periode) => periode.code)).toEqual(['A001', 'A002', 'A003'])
    expect(periods.find((periode) => periode.code === PERIODE)?.current).toBe(true)
    expect(grades.length).toBeGreaterThan(10)
    expect(subjectAverages.filter((entry) => entry.periodCode === PERIODE).length).toBeGreaterThan(5)
  })

  it('fabrique une matière dont la moyenne publiée ignore la dernière note', async () => {
    const { grades, subjectAverages } = await releve()
    const matieres = reconcileSubjectAverages(subjectAverages, grades, PERIODE)

    const maths = matieres.find((entry) => entry.average.subject === 'Mathématiques')
    expect(maths?.verdict.origin).toBe('recomputed')
    expect(maths?.verdict.behind).toHaveLength(1)
    // La note oubliée par le bulletin est bien la plus récente de la matière.
    const dernieres = grades
      .filter((note) => note.subject === 'Mathématiques' && note.periodCode === PERIODE && note.counted)
      .map((note) => note.date ?? '')
      .sort()
    expect(maths?.verdict.behind[0]?.date).toBe(dernieres[dernieres.length - 1])
    // Et la moyenne affichée n'est pas celle du bulletin.
    expect(maths?.verdict.value).not.toBe(maths?.verdict.official)
  })

  it('montre aussi les deux autres cas : le bulletin à jour, et pas de moyenne du tout', async () => {
    const { grades, subjectAverages } = await releve()
    const matieres = reconcileSubjectAverages(subjectAverages, grades, PERIODE)

    // L'EPS n'a pas de moyenne publiée : elle est calculée, et annoncée comme telle.
    expect(matieres.find((entry) => entry.average.subject === 'EPS')?.verdict.origin).toBe('computed')
    // Partout ailleurs, le bulletin connaît les dernières notes et garde la main.
    const officielles = matieres.filter((entry) => entry.verdict.origin === 'official')
    expect(officielles.length).toBeGreaterThanOrEqual(5)
  })

  it('recalcule la moyenne générale, puisqu’une matière est en retard', async () => {
    const { periods, grades, subjectAverages } = await releve()
    const periode = periods.find((entry) => entry.code === PERIODE)
    const verdict = generalAverage(periode?.average, grades, PERIODE, subjectAverages)

    expect(verdict.origin).toBe('recomputed')
    expect(verdict.computed).toBe(true)
    expect(verdict.official).toBeDefined()
    expect(verdict.value).not.toBe(verdict.official)
    expect(verdict.behind).toHaveLength(1)
  })

  it('ne parle qu’à son faux serveur : une route inconnue est refusée, pas devinée', async () => {
    const engine = demoEngine(JOUR)
    const response = await engine.send({
      method: 'POST',
      url: 'https://api.ecoledirecte.com/v3/eleves/4021/inconnue.awp',
      headers: {},
      body: '',
    })
    // Un HTTP 200 qui refuse : c'est exactement ce que fait le vrai service.
    expect(response.status).toBe(200)
    expect(JSON.parse(response.body ?? '{}').code).toBe(403)
  })
})
