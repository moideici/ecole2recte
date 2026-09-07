import type { Cookies } from '@sveltejs/kit'
import type { Account } from '@ecole2recte/protocol'
import { type SessionRecord, sessions } from './store.js'

export const COOKIE_NAME = 'e2r'

/**
 * Le cookie de session.
 *
 * `httpOnly` : aucun script de la page ne peut le lire, donc une faille d'injection ne
 * l'emporte pas. `sameSite: strict` : il n'accompagne pas une requête venue d'ailleurs.
 * `secure` hors développement : il ne voyage pas en clair. Il ne contient qu'un identifiant
 * opaque — ni jeton, ni identifiant ÉcoleDirecte, ni rien qui se relise.
 */
export function setSessionCookie(cookies: Cookies, id: string, secure: boolean): void {
  cookies.set(COOKIE_NAME, id, {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure,
    maxAge: 12 * 60 * 60,
  })
}

export function clearSessionCookie(cookies: Cookies): void {
  cookies.delete(COOKIE_NAME, { path: '/' })
}

export function readSession(cookies: Cookies): { id: string; record: SessionRecord } | null {
  const id = cookies.get(COOKIE_NAME)
  if (!id) return null
  const record = sessions.read(id)
  return record ? { id, record } : null
}

export function activeAccount(record: SessionRecord): Account | null {
  if (record.accounts.length === 0) return null
  return record.accounts.find((account) => account.id === record.activeAccountId) ?? record.accounts[0] ?? null
}
