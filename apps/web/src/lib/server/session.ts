import type { Cookies } from '@sveltejs/kit'
import type { Account } from '@ecole2recte/protocol'
import { SESSION_LONGUE_TTL_MS, SESSION_TTL_MS, type SessionRecord, type SessionStore } from './store.js'

export const COOKIE_NAME = 'e2r'

/**
 * Le cookie de session.
 *
 * `httpOnly` : aucun script de la page ne peut le lire, donc une faille d'injection ne
 * l'emporte pas. `sameSite: lax` : il n'accompagne pas une requête d'écriture venue d'ailleurs, mais il
 * suit un simple lien — avec `strict`, ouvrir le site depuis un message ou un favori d'une
 * autre application faisait croire à une déconnexion.
 * `secure` hors développement : il ne voyage pas en clair. Il ne contient qu'un identifiant
 * opaque — ni jeton, ni identifiant ÉcoleDirecte, ni rien qui se relise.
 */
export function setSessionCookie(cookies: Cookies, id: string, secure: boolean, remembered = false): void {
  cookies.set(COOKIE_NAME, id, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure,
    // Aligné sur la vie du magasin : un cookie qui meurt avant la session rend « rester
    // connecté » sans effet, et c'est exactement ce qui se produisait à douze heures.
    maxAge: Math.floor((remembered ? SESSION_LONGUE_TTL_MS : SESSION_TTL_MS) / 1000),
  })
}

export function clearSessionCookie(cookies: Cookies): void {
  cookies.delete(COOKIE_NAME, { path: '/' })
}

export async function readSession(
  cookies: Cookies,
  store: SessionStore,
): Promise<{ id: string; record: SessionRecord } | null> {
  const id = cookies.get(COOKIE_NAME)
  if (!id) return null
  const record = await store.read(id)
  return record ? { id, record } : null
}

export function activeAccount(record: SessionRecord): Account | null {
  if (record.accounts.length === 0) return null
  return record.accounts.find((account) => account.id === record.activeAccountId) ?? record.accounts[0] ?? null
}
