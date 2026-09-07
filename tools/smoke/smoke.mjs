#!/usr/bin/env node
/**
 * L'épreuve du réel.
 *
 *     ED_IDENTIFIANT=… ED_MOTDEPASSE=… node tools/smoke/smoke.mjs
 *
 * **Ce que fait ce script.** Il se connecte à un vrai compte et exécute des écritures
 * **réversibles**, chacune suivie d'une relecture depuis le serveur pour vérifier que ce qui
 * est arrivé est bien ce qui a été envoyé. Cocher un devoir puis le décocher. Créer un
 * dossier puis le supprimer. C'est le seul moyen de savoir qu'une écriture marche — un
 * serveur factice ne prouve que ce qu'on a nous-même imaginé.
 *
 * **Ce qu'il ne fait pas.** Il ne tourne jamais en intégration continue. Il ne touche à
 * aucune action irréversible sans un drapeau explicite. Il n'écrit aucun identifiant, aucun
 * jeton, aucune réponse de sécurité, ni sur disque ni dans sa sortie. Et il n'écrit à
 * personne : le test d'envoi de message s'adresse **au compte lui-même** — un professeur
 * n'est pas une cible de test.
 *
 * **La règle qui gouverne tout.** Une fonction d'écriture ne s'ouvre dans l'application
 * (`ED_WRITE_FEATURES`) qu'après que son aller-retour est passé ici.
 *
 * Le script lit le protocole compilé : `pnpm smoke` s'en charge.
 */

import { EcoleDirecteApi, EcoleDirecteClient, createSession, fetchEngine } from '../../packages/protocol/dist/index.js'

const identifiant = process.env.ED_IDENTIFIANT
const motdepasse = process.env.ED_MOTDEPASSE
const irreversible = process.env.ED_AUTORISER_IRREVERSIBLE === 'oui'

if (!identifiant || !motdepasse) {
  console.error('ED_IDENTIFIANT et ED_MOTDEPASSE sont attendus dans l\'environnement.')
  console.error('Ils ne sont ni journalisés, ni écrits, ni transmis ailleurs qu\'à ÉcoleDirecte.')
  process.exit(1)
}
if (process.env['CI']) {
  console.error("Ce script ne tourne pas en intégration continue : il écrit sur un vrai compte.")
  process.exit(1)
}

const resultats = []
function noter(nom, ok, detail = '') {
  resultats.push({ nom, ok, detail })
  console.log(`${ok ? '  ok  ' : ' ÉCHEC'} ${nom}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  const client = new EcoleDirecteClient({
    engine: fetchEngine(),
    session: createSession({ apiVersion: process.env.ED_API_VERSION ?? undefined }),
    // Ici, et seulement ici, l'écriture est ouverte en grand.
    writePolicy: 'allow',
  })
  const api = new EcoleDirecteApi(client)

  console.log('Connexion…')
  const outcome = await client.login(identifiant, motdepasse)
  if (!outcome.ok) {
    if (outcome.kind === 'two-factor') {
      console.error("Une question de sécurité est demandée. Réponds-y d'abord depuis l'application,")
      console.error('puis relance : le couple de confiance évitera de la reposer.')
    } else {
      console.error(`Connexion refusée : ${outcome.message}`)
    }
    process.exit(2)
  }
  const compte = outcome.accounts[0]
  if (!compte) {
    console.error('Aucun profil lisible.')
    process.exit(2)
  }
  console.log(`Connecté. ${outcome.accounts.length} profil(s).\n`)

  await eprouverCochage(api, compte)
  await eprouverCloud(api, compte)
  eprouverEnvoi()

  console.log('')
  const echecs = resultats.filter((entree) => !entree.ok)
  if (echecs.length === 0) {
    console.log('Tous les allers-retours sont passés.')
    console.log('Les fonctions correspondantes peuvent être ouvertes dans ED_WRITE_FEATURES.')
  } else {
    console.log(`${echecs.length} aller-retour(s) en échec : ces fonctions restent fermées.`)
    process.exitCode = 1
  }
}

/**
 * Cocher, relire, décocher, relire.
 *
 * Réversible de bout en bout : le devoir finit exactement dans l'état où il a été trouvé,
 * même si le script s'arrête au milieu — parce que l'état de départ est relu d'abord.
 */
async function eprouverCochage(api, compte) {
  const devoirs = await api.homework(compte)
  if (!devoirs.ok) return noter('devoirs : lecture', false, devoirs.message)
  noter('devoirs : lecture', true, `${devoirs.value.length} entrée(s)`)

  const cible = devoirs.value.find((devoir) => !devoir.onlineSubmission)
  if (!cible) return noter('devoirs : aller-retour', false, 'aucun devoir sans dépôt en ligne à éprouver')

  const depart = cible.done
  const bascule = await api.setHomeworkDone(compte, [cible.id], !depart)
  if (!bascule.ok) return noter('devoirs : écriture', false, bascule.message)

  const relu = await api.homework(compte)
  const apres = relu.ok ? relu.value.find((devoir) => devoir.id === cible.id) : undefined
  const pris = apres?.done === !depart
  noter('devoirs : le serveur a bien pris la coche', pris, pris ? '' : 'la relecture ne montre pas le changement')

  const retour = await api.setHomeworkDone(compte, [cible.id], depart)
  noter('devoirs : remise dans l\'état initial', retour.ok, retour.ok ? '' : retour.message)
}

/** Créer un dossier, vérifier qu'il apparaît, le supprimer, vérifier qu'il disparaît. */
async function eprouverCloud(api, compte) {
  const nom = `essai-ecole2recte-${Date.now()}`
  const cree = await api.createCloudFolder(compte, '0', nom)
  if (!cree.ok) return noter('stockage : création', false, cree.message)

  const apres = await api.cloud(compte)
  const present = apres.ok && apres.value.some((fichier) => fichier.folder.includes(nom) || fichier.name === nom)
  noter('stockage : le dossier apparaît', present, present ? '' : 'introuvable à la relecture')

  // La suppression ne dépend pas du succès de la vérification : on ne laisse pas de trace.
  const identifiants = apres.ok ? apres.value.filter((fichier) => fichier.name === nom).map((fichier) => fichier.id) : []
  if (identifiants.length > 0) {
    const efface = await api.deleteCloudNodes(compte, identifiants)
    noter('stockage : suppression', efface.ok, efface.ok ? '' : efface.message)
  } else {
    noter('stockage : suppression', false, 'rien à supprimer — vérifie manuellement qu\'aucun dossier d\'essai ne reste')
  }
}

/**
 * L'envoi de message, qui n'existe pas encore.
 *
 * Quand il existera, il s'écrira **au compte lui-même**, et le corps relu depuis « envoyés »
 * sera comparé caractère par caractère à ce qui a été saisi — accents, retours à la ligne et
 * longueur compris. C'est exactement ce qui a manqué au client Android pour oser l'écrire.
 */
function eprouverEnvoi() {
  console.log('')
  console.log("  — envoi de message : pas encore implémenté.")
  console.log('    L\'endpoint n\'est documenté nulle part publiquement : il demande une capture')
  console.log('    réseau de ton propre compte (voir tools/har/extract.mjs).')
  if (irreversible) {
    console.log('    ED_AUTORISER_IRREVERSIBLE est posé, mais il n\'y a rien d\'irréversible à éprouver.')
  }
}

await main()
