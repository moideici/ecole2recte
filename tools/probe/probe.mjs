#!/usr/bin/env node
/**
 * Sondage du service, sans compte et sans identifiants.
 *
 * Il ne touche qu'un point d'entrée public et non authentifié — celui qui distribue le
 * jeton GTK — et se contente de lire les en-têtes de la réponse. Aucune connexion n'est
 * tentée, aucun mot de passe n'est demandé, rien n'est écrit.
 *
 * Il répond à la question qui commande l'architecture : le service accepte-t-il d'être
 * appelé depuis un navigateur, ou faut-il un mandataire côté serveur ?
 *
 *     node tools/probe/probe.mjs
 */

const BASE = process.env.ED_API_BASE ?? 'https://api.ecoledirecte.com/v3'
const VERSION = process.env.ED_API_VERSION ?? '4.75.0'
const ORIGIN = process.env.ED_PROBE_ORIGIN ?? 'https://ecole2recte.local'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'

const CORS_HEADERS = [
  'access-control-allow-origin',
  'access-control-allow-credentials',
  'access-control-allow-headers',
  'access-control-allow-methods',
  'access-control-max-age',
]

/** Ce qui peut être affiché : jamais un jeton, jamais un cookie. */
function safeHeaders(response) {
  const shown = {}
  for (const [name, value] of response.headers) {
    const key = name.toLowerCase()
    if (key === 'set-cookie' || key === 'x-gtk' || key === 'x-token' || key === '2fa-token') {
      shown[key] = `<présent, ${value.length} caractères, non affiché>`
      continue
    }
    shown[key] = value
  }
  return shown
}

function report(title, headers) {
  const found = CORS_HEADERS.filter((name) => headers[name] !== undefined)
  console.log(`\n— ${title}`)
  if (found.length === 0) {
    console.log('  Aucun en-tête CORS. Un navigateur refuserait la réponse.')
    return false
  }
  for (const name of found) console.log(`  ${name}: ${headers[name]}`)
  return true
}

async function main() {
  console.log(`Sondage de ${BASE} (version ${VERSION}), origine annoncée ${ORIGIN}.`)
  console.log('Aucun identifiant n\'est utilisé : seul le point d\'entrée public GTK est interrogé.')

  let simple = false
  let preflight = false

  try {
    const response = await fetch(`${BASE}/login.awp?gtk=1&v=${encodeURIComponent(VERSION)}`, {
      method: 'GET',
      headers: { Origin: ORIGIN, Accept: 'application/json, text/plain, */*', 'User-Agent': USER_AGENT },
    })
    const headers = safeHeaders(response)
    console.log(`\nRéponse GTK : HTTP ${response.status}`)
    console.log(`  jeton GTK reçu : ${headers['x-gtk'] ? 'oui' : 'non'}`)
    simple = report('Requête simple (GET)', headers)
  } catch (error) {
    console.error(`\nLe service est injoignable : ${error.message}`)
    process.exitCode = 2
    return
  }

  try {
    // Ce contrôle-ci est le vrai : `X-Token` n'est pas un en-tête de la liste sûre, donc
    // toute requête authentifiée depuis un navigateur déclenche d'abord un préambule.
    const response = await fetch(`${BASE}/login.awp?v=${encodeURIComponent(VERSION)}`, {
      method: 'OPTIONS',
      headers: {
        Origin: ORIGIN,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'x-token,x-gtk,content-type',
        'User-Agent': USER_AGENT,
      },
    })
    const headers = safeHeaders(response)
    console.log(`\nRéponse au préambule : HTTP ${response.status}`)
    preflight = report('Préambule (OPTIONS) pour une requête authentifiée', headers)
  } catch (error) {
    console.error(`\nPréambule injoignable : ${error.message}`)
  }

  console.log('\nConclusion')
  if (preflight) {
    console.log('  Le service autorise un appel authentifié depuis un navigateur.')
    console.log('  Un client purement statique serait envisageable — mais garder le mandataire')
    console.log('  reste préférable : il évite que le jeton descende jusqu\'au navigateur.')
  } else if (simple) {
    console.log('  Le service tolère la lecture simple mais pas les en-têtes authentifiés.')
    console.log('  Le mandataire côté serveur reste obligatoire.')
  } else {
    console.log('  Aucun en-tête CORS : le mandataire côté serveur est obligatoire.')
    console.log('  C\'est l\'hypothèse de travail retenue par l\'architecture.')
  }
  console.log('\nÀ vérifier aussi depuis un vrai navigateur : ouvre tools/probe/cors.html.')
}

await main()
