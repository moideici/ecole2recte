import type { Account, AccountModule } from '../models.js'

/**
 * Lecture des comptes rendus par `login.awp`.
 *
 * Défensif par principe : l'API n'est pas documentée, et une clé absente chez un
 * établissement est présente chez le suivant. Une réponse à moitié comprise vaut mieux
 * qu'une exception qui vide l'écran.
 */

type Json = Record<string, unknown>

function asObject(value: unknown): Json | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function text(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return ''
}

/** La classe se présente tantôt comme un objet, tantôt comme un simple libellé. */
function className(profile: Json | null): string {
  if (!profile) return ''
  const classe = profile['classe']
  const asObj = asObject(classe)
  if (asObj) return text(asObj['libelle'] ?? asObj['code'])
  return text(classe)
}

function modules(source: Json): AccountModule[] {
  const found: AccountModule[] = []
  for (const raw of asArray(source['modules'])) {
    const module = asObject(raw)
    if (!module) continue
    const code = text(module['code'])
    if (code === '') continue
    found.push({ code, enabled: module['enable'] !== false })
  }
  return found
}

function studentFrom(source: Json, schoolName: string, family?: { id: string; name: string }): Account {
  const profile = asObject(source['profile'])
  const account: Account = {
    id: text(source['id']),
    type: 'E',
    firstName: text(source['prenom']),
    lastName: text(source['nom']),
    className: className(profile) || className(source),
    schoolName: text(source['nomEtablissement']) || schoolName,
    modules: modules(source),
  }
  if (family) {
    account.familyId = family.id
    account.familyName = family.name
  }
  return account
}

/**
 * Un compte parent ne rend pas un élève : il rend une famille et ses enfants. Donner
 * l'identifiant de la famille aux appels élève fait répondre « accès refusé » à tous.
 * Chaque enfant devient donc un profil complet, qui garde l'identifiant de la famille pour
 * la seule messagerie.
 */
export function parseAccounts(data: unknown): Account[] {
  const root = asObject(data)
  if (!root) return []
  const accounts: Account[] = []
  for (const raw of asArray(root['accounts'])) {
    const source = asObject(raw)
    if (!source) continue
    const type = text(source['typeCompte']) || 'E'
    const schoolName = text(source['nomEtablissement'])
    if (type.toUpperCase() === 'E') {
      accounts.push(studentFrom(source, schoolName))
      continue
    }
    const profile = asObject(source['profile'])
    const children = asArray(profile?.['eleves'])
    const family = {
      id: text(source['id']),
      name: [text(source['prenom']), text(source['nom'])].filter((part) => part !== '').join(' '),
    }
    for (const child of children) {
      const source2 = asObject(child)
      if (!source2) continue
      accounts.push(studentFrom(source2, schoolName, family))
    }
    // Une famille sans enfant lisible reste un compte : la messagerie, elle, fonctionne.
    if (children.length === 0) {
      accounts.push({
        id: family.id,
        type,
        firstName: text(source['prenom']),
        lastName: text(source['nom']),
        className: '',
        schoolName,
        modules: modules(source),
      })
    }
  }
  return accounts
}
