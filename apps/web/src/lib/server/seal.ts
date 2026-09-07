import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { env } from '$env/dynamic/private'

/**
 * Scellement d'une petite valeur destinée à revenir dans un cookie.
 *
 * Sert au seul couple de confiance `cn`/`cv` de la question de sécurité. Ce n'est pas un
 * mot de passe — c'est la preuve qu'on a déjà répondu — mais il vaut une session, donc il
 * voyage chiffré et authentifié (AES-256-GCM), et jamais en clair.
 *
 * La clé vient de `SESSION_SECRET`. En développement, une clé dérivée du nom de la machine
 * évite d'exiger une configuration pour lancer l'application ; en production, l'absence de
 * secret est une erreur franche plutôt qu'un chiffrement décoratif.
 */
function key(): Buffer {
  const secret = env['SESSION_SECRET']
  if (secret && secret.length >= 16) return createHash('sha256').update(secret).digest()
  if (env['NODE_ENV'] === 'production') {
    throw new Error("SESSION_SECRET est absent : refus de sceller avec une clé devinable.")
  }
  return createHash('sha256').update('developpement-local-ecole2recte').digest()
}

export function seal(value: unknown): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const payload = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), payload.toString('base64url')].join('.')
}

export function unseal<T>(sealed: string | undefined): T | null {
  if (!sealed) return null
  const parts = sealed.split('.')
  if (parts.length !== 3) return null
  try {
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(parts[0] as string, 'base64url'))
    decipher.setAuthTag(Buffer.from(parts[1] as string, 'base64url'))
    const plain = Buffer.concat([decipher.update(Buffer.from(parts[2] as string, 'base64url')), decipher.final()])
    return JSON.parse(plain.toString('utf8')) as T
  } catch {
    // Sceau invalide ou clé changée : on l'ignore, on ne s'en sert pas.
    return null
  }
}
