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
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  EcoleDirecteApi,
  EcoleDirecteClient,
  choiceForAnswer,
  readDate,
  createSession,
  fetchEngine,
  generalAverage,
} from '../../packages/protocol/dist/index.js'

if (process.env['CI']) {
  console.error("Ce script ne tourne pas en intégration continue : il se connecte à un vrai compte.")
  process.exit(1)
}

/*
 * Le `.env` de la racine, s'il existe.
 *
 * Node ne charge pas ces fichiers tout seul : sans cette ligne, un identifiant posé là est
 * simplement ignoré, et le script redemande tout au clavier comme s'il n'y avait rien.
 * Le fichier est ignoré par git — c'est la première chose que `.gitignore` protège.
 */
const racine = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
try {
  process.loadEnvFile(join(racine, '.env'))
} catch {
  // Pas de fichier, ou illisible : on demandera au clavier.
}

/** La première variable renseignée parmi plusieurs orthographes raisonnables. */
function lire(...noms) {
  for (const nom of noms) {
    const valeur = process.env[nom]
    if (typeof valeur === 'string' && valeur.trim() !== '') return valeur.trim()
  }
  return ''
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

/**
 * `--config` : ce que le script voit, avant de toucher au reseau.
 *
 * Il n'imprime AUCUNE valeur, pas meme une longueur : seulement present ou absent, et d'ou
 * cela vient. C'est ce qui manquait ici, car une configuration ignoree ressemblait a un
 * verificateur casse.
 */
function verifierConfig() {
  const source = (...noms) => noms.find((nom) => lire(nom) !== '') ?? null
  const lignes = [
    ['identifiant', source('ED_IDENTIFIANT', 'id', 'ID', 'identifiant')],
    ['mot de passe', source('ED_MOTDEPASSE', 'mdp', 'MDP', 'motdepasse')],
    ['reponse de securite', source('ED_REPONSE', 'reponse', 'ED_NAISSANCE', 'naissance')],
  ]
  console.log('Configuration lue. Aucune valeur n’est affichee.')
  console.log('')
  for (const [nom, cle] of lignes) {
    const etat = cle ? ' ok   ' : 'absent'
    console.log(`  ${etat} ${nom.padEnd(18)}${cle ? `depuis ${cle}` : 'sera demande au clavier'}`)
  }

  const naissance = lire('ED_NAISSANCE', 'naissance')
  if (naissance !== '') {
    const bonne = /^\d{4}-\d{2}-\d{2}$/.test(naissance)
    console.log('')
    console.log(`  ${bonne ? ' ok   ' : 'ECHEC '} format de la date ${bonne ? 'AAAA-MM-JJ' : '— attendu AAAA-MM-JJ'}`)
    if (!bonne) process.exitCode = 1
  }
  console.log('')
  console.log('Relance sans --config pour eprouver la connexion.')
}

async function main() {
  console.log('Vérificateur ecole2recte — lecture seule, aucune écriture ne partira.\n')

  if (process.argv.includes('--config')) return verifierConfig()

  const identifiant = lire('ED_IDENTIFIANT', 'id', 'ID', 'identifiant') || (await demander('Identifiant ÉcoleDirecte : '))
  const motdepasse = lire('ED_MOTDEPASSE', 'mdp', 'MDP', 'motdepasse') || (await demander('Mot de passe (invisible) : ', true))
  const naissance =
    lire('ED_REPONSE', 'reponse', 'ED_NAISSANCE', 'naissance')

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

    const donnee = reponse || (await demander('Reponse a cette question (vide pour la choisir dans la liste) : '))

    let choisi = donnee === '' ? null : choiceForAnswer(question.value.choices, donnee)
    if (choisi !== null) {
      noter('la reponse donnee correspond', 'ok', `forme ${forme(choisi)}`)
    } else {
      // Le compte du diagnostic porte sur ce qui **se lit comme une date**, et non sur ce
      // qui contient un chiffre : une classe s'ecrit `1ERE G2`, et n'est pas une date.
      const dates = question.value.choices.filter((choix) => readDate(choix) !== undefined).length
      noter(
        'la reponse donnee correspond',
        donnee === '' ? 'skip' : 'ko',
        donnee === ''
          ? 'aucune reponse donnee d avance'
          : `aucune des ${question.value.choices.length} propositions n est cette reponse` +
            ` (${dates} se lisent comme des dates)`,
      )

      // On poursuit quand meme : le reste du verificateur porte sur le jeton, et c'est
      // justement ce qu'on ne saurait pas sinon.
      console.log('')
      question.value.choices.forEach((choix, index) => console.log(`   ${String(index + 1).padStart(2)}. ${choix}`))
      console.log('')
      const numero = Number(await demander('Numero de la bonne reponse (0 pour arreter) : '))
      if (!Number.isInteger(numero) || numero < 1 || numero > question.value.choices.length) return conclure()
      choisi = question.value.choices[numero - 1]
    }

    const repondu = await client.answerSecurityQuestion(choisi)
    if (!repondu.ok) {
      noter('le service accepte la reponse', 'ko', repondu.message)
      return conclure()
    }
    noter('le service accepte la reponse', 'ok', 'couple de confiance obtenu')

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
