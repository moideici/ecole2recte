import { describe, expect, it } from 'vitest'
import { hasModule, isStudent, mailboxId, mailboxSegment, viewedByFamily } from '../src/models.js'
import { parseAccounts } from '../src/parse/accounts.js'
import { FAMILY_PAYLOAD, STUDENT_PAYLOAD } from './fake.js'

describe('parseAccounts', () => {
  it('lit un compte élève', () => {
    const [account] = parseAccounts(STUDENT_PAYLOAD)
    expect(account?.id).toBe('4242')
    expect(account?.className).toBe('1re G2')
    expect(account && isStudent(account)).toBe(true)
    expect(account && viewedByFamily(account)).toBe(false)
    expect(account && mailboxSegment(account)).toBe('eleves')
  })

  it("n'ouvre que les modules accordés", () => {
    const [account] = parseAccounts(STUDENT_PAYLOAD)
    expect(account && hasModule(account, 'NOTES')).toBe(true)
    // Accordé mais désactivé par l'établissement : la fonction ne doit pas être proposée.
    expect(account && hasModule(account, 'CLOUD')).toBe(false)
    expect(account && hasModule(account, 'INEXISTANT')).toBe(false)
  })

  it('déplie un compte famille en un profil par enfant', () => {
    const accounts = parseAccounts(FAMILY_PAYLOAD)
    expect(accounts.map((account) => account.id)).toEqual(['4242', '4243'])
    expect(accounts.every((account) => isStudent(account))).toBe(true)
    expect(accounts[0]?.familyName).toBe('Sophie Durand')
    expect(accounts[0]?.schoolName).toBe('Lycée Victor Hugo')
  })

  it('accepte la classe en objet comme en simple libellé', () => {
    const accounts = parseAccounts(FAMILY_PAYLOAD)
    expect(accounts[0]?.className).toBe('1re G2')
    expect(accounts[1]?.className).toBe('5e B')
  })

  it("adresse la messagerie à la famille, jamais à l'enfant", () => {
    const [child] = parseAccounts(FAMILY_PAYLOAD)
    // C'est l'erreur qui fait répondre « accès refusé » à tous les appels d'un compte parent.
    expect(child && mailboxId(child)).toBe('99')
    expect(child && mailboxSegment(child)).toBe('familles')
  })

  it('garde une famille sans enfant lisible, pour sa messagerie', () => {
    const accounts = parseAccounts({ accounts: [{ id: 7, typeCompte: '1', prenom: 'A', nom: 'B', profile: {} }] })
    expect(accounts).toHaveLength(1)
    expect(accounts[0]?.id).toBe('7')
  })

  it('ne lève pas sur une réponse vide ou biscornue', () => {
    expect(parseAccounts(null)).toEqual([])
    expect(parseAccounts({})).toEqual([])
    expect(parseAccounts({ accounts: 'non' })).toEqual([])
  })
})
