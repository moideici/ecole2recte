#!/usr/bin/env node
/**
 * Extraction de la *forme* d'un endpoint depuis une capture réseau.
 *
 *     node tools/har/extract.mjs capture.har > forme.json
 *
 * **Pourquoi cet outil existe.** L'envoi d'un message, la justification d'une absence et le
 * rendu d'un devoir ne sont documentés nulle part publiquement. La seule façon honnête de
 * les connaître est de faire l'action une fois sur le vrai site, avec son propre compte, et
 * de regarder ce qui est parti. Deviner une écriture, c'est livrer un message tronqué à un
 * professeur.
 *
 * **Ce que l'outil ne laisse pas sortir.** Un HAR brut porte le mot de passe en clair dans
 * le corps du login et le `X-Token` dans chaque en-tête suivant : il est aussi sensible
 * qu'un mot de passe noté sur un papier. Cet outil n'en tire que les **noms** de champs et
 * les **types** de valeurs — jamais les valeurs elles-mêmes. Le HAR d'origine reste sur ta
 * machine, et `.gitignore` refuse déjà `*.har` et `captures/`.
 */

import { readFileSync } from 'node:fs'

/** Ce qui ne doit jamais sortir, quel que soit le contexte. */
const INTERDITS = /^(motdepasse|password|token|access_token|cn|cv|choix|fa|identifiant|login|uuid)$/i

/** Une valeur devient sa forme : « une chaîne », « un nombre », « une liste de… ». */
function forme(valeur, cle = '') {
  if (INTERDITS.test(cle)) return '<expurgé>'
  if (valeur === null) return 'null'
  if (Array.isArray(valeur)) {
    if (valeur.length === 0) return '[]'
    return [forme(valeur[0])]
  }
  switch (typeof valeur) {
    case 'string':
      // Une chaîne longue est presque toujours un jeton ou un contenu : on ne la décrit
      // que par sa longueur.
      return valeur.length > 64 ? `<chaîne, ${valeur.length} caractères>` : '<chaîne>'
    case 'number':
      return '<nombre>'
    case 'boolean':
      return '<booléen>'
    case 'object': {
      const out = {}
      for (const [nom, sous] of Object.entries(valeur)) out[nom] = forme(sous, nom)
      return out
    }
    default:
      return '<inconnu>'
  }
}

function corps(entree) {
  const texte = entree.request?.postData?.text ?? ''
  if (texte === '') return null
  const brut = texte.startsWith('data=') ? decodeURIComponent(texte.slice(5)) : texte
  try {
    return forme(JSON.parse(brut))
  } catch {
    return `<corps non JSON, ${texte.length} caractères>`
  }
}

function main() {
  const chemin = process.argv[2]
  if (!chemin) {
    console.error('Usage : node tools/har/extract.mjs capture.har')
    process.exit(1)
  }
  const har = JSON.parse(readFileSync(chemin, 'utf8'))
  const entrees = har.log?.entries ?? []

  const retenues = entrees
    .filter((entree) => /ecoledirecte\.com/.test(entree.request?.url ?? ''))
    .map((entree) => {
      const url = new URL(entree.request.url)
      return {
        methode: entree.request.method,
        hote: url.host,
        chemin: url.pathname,
        // Les paramètres de requête portent le verbe et la version : ce sont eux qui
        // décrivent l'appel, et aucun n'est secret.
        parametres: Object.fromEntries(url.searchParams),
        // Seuls les noms d'en-têtes, jamais leurs valeurs.
        entetes: (entree.request.headers ?? []).map((entete) => entete.name.toLowerCase()).sort(),
        corps: corps(entree),
        statut: entree.response?.status ?? null,
        codeMetier: codeMetier(entree),
      }
    })

  if (retenues.length === 0) {
    console.error('Aucune requête ÉcoleDirecte dans cette capture.')
    process.exit(2)
  }

  const sortie = JSON.stringify({ requetes: retenues }, null, 2)
  verifier(sortie)
  console.log(sortie)
  console.error(`${retenues.length} requête(s) décrite(s). Aucune valeur n'a été reprise.`)
}

/** Le code métier de la réponse : il dit si l'action a réussi, ce que le statut HTTP tait. */
function codeMetier(entree) {
  const texte = entree.response?.content?.text ?? ''
  try {
    const corps = JSON.parse(texte)
    return typeof corps.code === 'number' ? corps.code : null
  } catch {
    return null
  }
}

/**
 * Dernier garde-fou avant d'écrire quoi que ce soit.
 *
 * Si une chaîne longue a traversé malgré tout, on refuse de sortir plutôt que d'écrire un
 * jeton dans un fichier qui finira dans un dépôt.
 */
function verifier(sortie) {
  const suspect = /"[A-Za-z0-9+/=_-]{200,}"/.exec(sortie)
  if (suspect) {
    console.error("Une chaîne très longue a échappé à l'expurgation : sortie refusée.")
    process.exit(3)
  }
}

main()
