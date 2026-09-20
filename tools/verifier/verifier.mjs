#!/usr/bin/env node
/**
 * L'épreuve du réel, en lecture seule.
 *
 *     pnpm verifier
 *
 * **Ce que fait ce script.** Il se connecte à un vrai compte et vérifie les deux mécanismes
 * qu'aucun test hors-ligne ne peut trancher : la **date de naissance** qui répond à la
 * question de sécurité, et le **renouvellement automatique du jeton**. Il lit ensuite une
 * section pour confirmer que la chaîne complète tient.
 *
 * **Ce qu'il n'écrit jamais.** Aucune écriture ne part : la police est sur `deny`, donc même
 * une erreur de code ne pourrait rien modifier. Pour les allers-retours d'écriture, c'est
 * `pnpm smoke`, et c'est un autre script exprès.
 *
 * **Ce qu'il ne montre pas.** Ni mot de passe, ni jeton, ni couple `cn`/`cv`, ni la date de
 * naissance. Le rapport final ne contient que des **formes** et des **codes** — pas une
 * valeur personnelle — précisément pour pouvoir être recopié à quelqu'un qui aide.
 *
 * Il lit le protocole compilé : `pnpm verifier` s'en charge.
 */

import { createInterface } from 'node:readline'
import {
  EcoleDirecteApi,
  EcoleDirecteClient,
  choiceForDate,
  createSession,
  fetchEngine,
  generalAverage,
} from '../../packages/protocol/dist/index.js'

if (process.env['CI']) {
  console.error("Ce script ne tourne pas en intégration continue : il se connecte à un vrai compte.")
  process.exit(1)
}

/** Demande au clavier ce qui n'a pas à traîner dans un fichier ni dans l'historique. */
async function demander(question, masque = false) {
  const lecture = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  if (masque) {
    const ecrire = lecture._writeToOutput?.bind(lecture)
    lecture._writeToOutput = (texte) => {
      if (texte.includes(question)) ecrire?.(texte)
    }
  }
  const reponse = await new Promise((resoudre) => lecture.question(question, resoudre))
  lecture.close()
  if (masque) process.stdout.write('\n')
  return reponse.trim()
}

const rapport = []
function noter(nom, etat, detail = '') {
  rapport.push({ nom, etat, detail })
  const marque = etat === 'ok' ? '  ok  ' : etat === 'skip' ? ' passé ' : ' ÉCHEC'
  console.log(`${marque} ${nom}${detail ? ` — ${detail}` : ''}`)
}

/**
 * La **forme** d'une proposition, jamais sa valeur.
 *
 * C'est tout ce qu'il faut pour corriger une lecture de date qui ne reconnaîtrait pas le
 * format d'un établissement — et cela ne dit rien de la personne.
 */
function forme(texte) {
  return texte
    .replace(/\d/gu, '9')
    .replace(/[A-Za-zÀ-ÿ]+/gu, (mot) => (mot.length > 2 ? 'Aaa' : 'Aa'))
}

async function main() {
  console.log('Vérificateur ecole2recte — lecture seule, aucune écriture ne partira.\n')

  const identifiant = process.env.ED_IDENTIFIANT || (await demander('Identifiant ÉcoleDirecte : '))
  const motdepasse = process.env.ED_MOTDEPASSE || (await demander('Mot de passe (invisible) : ', true))
  const naissance = await demander('Date de naissance AAAA-MM-JJ (vide pour ne pas l’utiliser) : ')

  if (!identifiant || !motdepasse) {
    console.error('Identifiant et mot de passe sont attendus.')
    process.exit(1)
  }
  console.log('')

  const client = new EcoleDirecteClient({
    engine: fetchEngine(),
    session: createSession({ apiVersion: process.env.ED_API_VERSION ?? undefined }),
    // Rien ne peut être modifié, même par erreur.
    writePolicy: 'deny',
  })
  const api = new EcoleDirecteApi(client)

  // ——————————————————————————————————————————— 1. connexion et question de sécurité

  let outcome = await client.login(identifiant, motdepasse)

  if (!outcome.ok && outcome.kind === 'two-factor') {
    noter('question de sécurité posée', 'ok', 'appareil non reconnu, comme attendu')

    const question = await client.securityQuestion()
    if (!question.ok) {
      noter('lecture de la question', 'ko', question.message)
      return conclure()
    }
    noter('lecture de la question', 'ok', `${question.value.choices.length} proposition(s)`)
    console.log(`\n       question : ${question.value.question}`)
    console.log(`       formes   : ${[...new Set(question.value.choices.map(forme))].join(' | ')}\n`)

    if (naissance === '') {
      noter('date de naissance', 'skip', 'non fournie')
      console.log('\nRelance en la donnant pour éprouver ce mécanisme.')
      return conclure()
    }

    const choisi = choiceForDate(question.value.choices, naissance)
    if (choisi === null) {
      const lisibles = question.value.choices.filter((choix) => forme(choix).includes('9')).length
      noter(
        'la date répond à la question',
        'ko',
        lisibles === 0
          ? "aucune proposition ne se lit comme une date : la question porte sur autre chose"
          : `${lisibles} proposition(s) lues comme des dates, aucune n'est celle donnée`,
      )
      console.log('\nSi les formes ci-dessus sont bien des dates, c’est la lecture qu’il faut corriger.')
      return conclure()
    }
    noter('la date répond à la question', 'ok', `forme ${forme(choisi)}`)

    const repondu = await client.answerSecurityQuestion(choisi)
    if (!repondu.ok) {
      noter('le service accepte la réponse', 'ko', repondu.message)
      return conclure()
    }
    noter('le service accepte la réponse', 'ok', 'couple de confiance obtenu')

    outcome = await client.login(identifiant, motdepasse, repondu.value, { fresh: true })
  } else if (outcome.ok) {
    noter('question de sécurité posée', 'skip', 'appareil déjà connu du service')
  }

  if (!outcome.ok) {
    noter('connexion', 'ko', outcome.message)
    return conclure()
  }
  const compte = outcome.accounts[0]
  noter('connexion', 'ok', `${outcome.accounts.length} profil(s) lisible(s)`)
  noter('titulaire retenu pour le renouvellement', client.session.userId ? 'ok' : 'ko', client.session.userId ? '' : 'absent')
  if (!compte) return conclure()

  // ——————————————————————————————————————————— 2. renouvellement du jeton

  const avant = client.session.token
  const renouvele = await client.renewToken(client.session.userId ?? compte.id)
  noter('renewtoken.awp accepté', renouvele.ok ? 'ok' : 'ko', renouvele.ok ? '' : renouvele.message)
  if (renouvele.ok) {
    const change = client.session.token !== null && client.session.token !== avant
    noter('un jeton neuf est rendu', change ? 'ok' : 'ko', change ? '' : 'le jeton n’a pas changé')
  }

  // Le jeton renouvelé sert-il vraiment ? Sans cette lecture, on ne sait rien.
  const apres = await api.homework(compte)
  noter('lecture après renouvellement', apres.ok ? 'ok' : 'ko', apres.ok ? `${apres.value.length} devoir(s)` : apres.message)

  // ——————————————————————————————————————————— 3. la chaîne complète, sur les notes

  const notes = await api.grades(compte)
  if (!notes.ok) {
    noter('lecture des notes', 'ko', notes.message)
    return conclure()
  }
  const { periods, grades, subjectAverages } = notes.value
  noter('lecture des notes', 'ok', `${periods.length} période(s), ${grades.length} note(s)`)

  const periode = periods.find((entree) => entree.current) ?? periods[0]
  if (periode) {
    const verdict = generalAverage(periode.average, grades, periode.code, subjectAverages)
    const dit = {
      official: 'le bulletin fait foi',
      recomputed: `recalculée : le bulletin ignore ${verdict.behind.length} note(s)`,
      computed: "l'établissement ne publie pas de moyenne",
      none: 'rien de chiffré',
    }
    noter('arbitrage de la moyenne', 'ok', dit[verdict.origin])
  }

  // ——————————————————————————————————————————— 4. le détail d'une journée

  const aVenir = apres.ok ? apres.value.map((devoir) => devoir.dueDate).sort()[0] : undefined
  if (aVenir) {
    const jour = await api.dayContent(compte, aVenir)
    noter(
      'détail d’une journée',
      jour.ok ? 'ok' : 'ko',
      jour.ok ? `${jour.value.homework.length} énoncé(s), ${jour.value.sessions.length} séance(s)` : jour.message,
    )
  } else {
    noter('détail d’une journée', 'skip', 'aucune date à interroger')
  }

  conclure()
}

function conclure() {
  console.log('\n————————————————————————————————————————————————')
  console.log('Rapport (aucune valeur personnelle — recopiable tel quel) :\n')
  for (const entree of rapport) {
    console.log(`${entree.etat.padEnd(5)} · ${entree.nom}${entree.detail ? ` — ${entree.detail}` : ''}`)
  }
  const echecs = rapport.filter((entree) => entree.etat === 'ko')
  console.log('')
  console.log(echecs.length === 0 ? 'Tout est passé.' : `${echecs.length} point(s) en échec.`)
  if (echecs.length > 0) process.exitCode = 1
}

main().catch((erreur) => {
  // Le message d'une exception peut porter une URL, jamais un secret : les corps ne sont pas
  // relancés ici. On reste malgré tout laconique.
  console.error(`\nInterrompu : ${erreur instanceof Error ? erreur.message : 'erreur inconnue'}`)
  process.exit(3)
})
