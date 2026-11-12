import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { env } from '$env/dynamic/private'

/**
 * La clé qui scelle ce qu'on garde (mot de passe, couple de confiance).
 *
 * **En production** : `SESSION_SECRET`, posé par `wrangler secret put`, et rien d'autre. Sans
 * lui, on ne garde rien — mieux vaut redemander le mot de passe que le chiffrer avec une clé
 * devinable.
 *
 * **En développement local sur Node** (`vite dev`, `NODE_ENV=development`) : exiger une
 * variable d'environnement pour essayer « Rester connecté » était un obstacle sans raison.
 * Une clé aléatoire est donc générée une fois et gardée dans `.data/secret`, fichier ignoré
 * par git et lisible par le seul utilisateur. Elle ne quitte pas la machine. Sous Cloudflare
 * Workers et sous les tests (`NODE_ENV` autre), ce chemin n'existe pas : le système de
 * fichiers n'y est pas là, et un test ne doit pas écrire sur le disque.
 */
export function sessionSecret(): string | undefined {
  const secret = env['SESSION_SECRET']
  if (typeof secret === 'string' && secret.length >= 16) return secret
  if (env['NODE_ENV'] !== 'development') return undefined
  return secretLocal()
}

let memoire: string | undefined

function secretLocal(): string | undefined {
  if (memoire) return memoire
  try {
    const dossier = join(process.cwd(), '.data')
    const fichier = join(dossier, 'secret')
    if (existsSync(fichier)) {
      const lu = readFileSync(fichier, 'utf8').trim()
      if (lu.length >= 32) return (memoire = lu)
    }
    mkdirSync(dossier, { recursive: true })
    const neuf = randomBytes(48).toString('base64url')
    // 0o600 : lisible par le seul utilisateur (sans effet sous Windows, sans conséquence).
    writeFileSync(fichier, neuf, { mode: 0o600 })
    return (memoire = neuf)
  } catch {
    // Pas de disque, pas de droit : on ne garde rien, et l'application marche quand même.
    return undefined
  }
}
