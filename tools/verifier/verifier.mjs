#!/usr/bin/env node
/**
 * L'épreuve du réel, en lecture seule.
 *
 *     pnpm verifier --config                        ce qu'il voit, sans rien appeler
 *     pnpm verifier --reponse "2011-02-28,1ERE G2"  les faits, une fois pour toutes
 *     pnpm verifier --questions                     la question tirée cette fois-ci
 *     pnpm verifier --choix 7                       répond avec la 7e proposition
 *     pnpm verifier --renouvellement                éprouve renewtoken.awp, exprès
 *
 * **La question est tirée au hasard à chaque connexion** — l'année de naissance, le jour, le
 * mois, la date entière, la classe. `--choix N` ne vaut donc que pour la connexion en cours,
 * et `--questions` suivi de `--choix` ne peut pas marcher : ce sont deux connexions, donc
 * deux questions. C'est `--reponse` qui tient, parce qu'il donne les **faits**.
 *
 * **Ce que fait ce script.** Il se connecte à un vrai compte et vérifie ce qu'aucun test
 * hors-ligne ne peut trancher : la **réponse à la question de sécurité** donnée d'avance.
 * Il lit ensuite de quoi confirmer que la chaîne complète tient.
 *
 * **Le renouvellement du jeton n'en fait plus partie.** Le 20 septembre 2026, il a répondu
 * ici par le message d'activité suspecte du service, alors que le jeton valait encore. On ne
 * le redemande donc qu'avec `--renouvellement`, quand on cherche exprès à le comprendre.
 *
 * **Ce qu'il coûte.** Chaque lancement est une **vraie connexion sur un vrai compte**, et
 * ÉcoleDirecte compte les connexions : le 20 septembre 2026, quelques essais d'affilée ont
 * fait bloquer le compte, qu'il a fallu débloquer à la main. Ce n'est pas un test qu'on
 * relance en boucle — on prépare ce qu'on veut savoir, puis on le lance une fois.
 *
 * **Ce qu'il n'écrit jamais.** Aucune écriture ne part : la police est sur `deny`, donc même
 * une erreur de code ne pourrait rien modifier. Pour les allers-retours d'écriture, c'est
 * `pnpm smoke`, et c'est un autre script exprès.
 *
 * **Ce qu'il ne montre pas.** Ni mot de passe, ni jeton, ni couple `cn`/`cv`. Le rapport
 * final ne contient que des **formes** et des **codes** — pas une valeur personnelle —
 * précisément pour pouvoir être recopié à quelqu'un qui aide. Les propositions, elles, ne
 * s'affichent qu'à l'écran de qui lance le script, et jamais dans le rapport.
 *
 * Il lit le protocole compilé : `pnpm verifier` s'en charge.
 */

import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  EcoleDirecteApi,
  EcoleDirecteClient,
  choiceForQuestion,
  createSession,
  fetchEngine,
  generalAverage,
  readDate,
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

/**
 * La valeur d'une option, écrite `--nom valeur` ou `--nom=valeur`.
 *
 * Les deux, parce qu'un argument traverse ici `npx`, puis `pnpm`, puis `node` : la forme
 * collée survit à des passages où la forme séparée se perd.
 */
function option(nom) {
  const colle = process.argv.find((entree) => entree.startsWith(`--${nom}=`))
  if (colle) return colle.slice(nom.length + 3).trim()
  const index = process.argv.indexOf(`--${nom}`)
  if (index === -1) return ''
  const suivant = process.argv[index + 1] ?? ''
  return suivant.startsWith('--') ? '' : suivant.trim()
}
const drapeau = (nom) => process.argv.some((entree) => entree === `--${nom}` || entree.startsWith(`--${nom}=`))

/**
 * Demande au clavier, quand il y en a un.
 *
 * Lancé à travers `npx` puis `pnpm`, le script n'hérite pas toujours d'une entrée utilisable.
 * Mieux vaut le dire que rester suspendu sans que rien ne s'affiche.
 */
async function demander(question, masque = false) {
  if (!process.stdin.isTTY) {
    console.log(`\n(pas de clavier utilisable ici — ${question.trim()})`)
    return ''
  }
  const lecture = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  if (masque) {
    const ecrire = lecture._writeToOutput?.bind(lecture)
    lecture._writeToOutput = (texte) => {
      if (texte.includes(question)) ecrire?.(texte)
    }
  }
  const saisie = await new Promise((resoudre) => lecture.question(question, resoudre))
  lecture.close()
  if (masque) process.stdout.write('\n')
  return saisie.trim()
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
 * C'est tout ce qu'il faut pour corriger une lecture qui ne reconnaîtrait pas l'écriture
 * d'un établissement — et cela ne dit rien de la personne.
 */
function forme(texte) {
  return texte.replace(/\d/gu, '9').replace(/[A-Za-zÀ-ÿ]+/gu, (mot) => (mot.length > 2 ? 'Aaa' : 'Aa'))
}

/**
 * `--config` : ce que le script voit, avant de toucher au réseau.
 *
 * Aucune valeur n'est imprimée, pas même une longueur : seulement présent ou absent, et d'où
 * cela vient. Une configuration ignorée ressemblait sinon à un vérificateur cassé.
 */
function verifierConfig() {
  const source = (...noms) => noms.find((nom) => lire(nom) !== '') ?? null
  const lignes = [
    ['identifiant', source('ED_IDENTIFIANT', 'id', 'ID', 'identifiant')],
    ['mot de passe', source('ED_MOTDEPASSE', 'mdp', 'MDP', 'motdepasse')],
    ['réponse de sécurité', source('ED_REPONSE', 'reponse', 'ED_NAISSANCE', 'naissance')],
  ]
  console.log('Configuration lue. Aucune valeur n’est affichée.')
  console.log('')
  for (const [nom, cle] of lignes) {
    const ou = cle ? `depuis ${cle}` : 'à donner en option ou au clavier'
    console.log(`  ${cle ? ' ok   ' : 'absent'} ${nom.padEnd(20)}${ou}`)
  }
  console.log('')
  const clavier = process.stdin.isTTY === true
  console.log(`  ${clavier ? ' ok   ' : 'absent'} ${'clavier utilisable'.padEnd(20)}${clavier ? '' : 'utilise --reponse ou --choix'}`)
  console.log('')
  console.log('Relance sans --config pour éprouver la connexion.')
}

async function main() {
  console.log('Vérificateur ecole2recte — lecture seule, aucune écriture ne partira.\n')

  if (drapeau('config')) return verifierConfig()

  const identifiant = lire('ED_IDENTIFIANT', 'id', 'ID', 'identifiant') || (await demander('Identifiant ÉcoleDirecte : '))
  const motdepasse = lire('ED_MOTDEPASSE', 'mdp', 'MDP', 'motdepasse') || (await demander('Mot de passe (invisible) : ', true))
  // Plusieurs faits, separes par des virgules : le service tire sa question au hasard, et
  // une reponse unique ne peut pas couvrir l'annee, le jour, le mois et la classe.
  const faits = (option('reponse') || lire('ED_REPONSE', 'reponse', 'ED_NAISSANCE', 'naissance'))
    .split(',')
    .map((entree) => entree.trim())
    .filter((entree) => entree !== '')
  const numero = Number(option('choix'))

  if (!identifiant || !motdepasse) {
    console.error('Identifiant et mot de passe sont attendus — pose-les dans .env (id= et mdp=).')
    process.exit(1)
  }

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
    const choix = question.value.choices
    noter('lecture de la question', 'ok', `${choix.length} proposition(s)`)
    console.log(`\n       question : ${question.value.question}`)
    console.log(`       formes   : ${[...new Set(choix.map(forme))].join(' | ')}\n`)

    // `--questions` : on montre la liste et on s'arrête. C'est le pas qui manquait quand le
    // clavier n'est pas utilisable.
    if (drapeau('questions')) {
      choix.forEach((entree, index) => console.log(`   ${String(index + 1).padStart(2)}. ${entree}`))
      console.log('\nRelance avec  --choix N  pour répondre avec la proposition N.')
      return conclure()
    }

    let retenu = null
    if (Number.isInteger(numero) && numero >= 1 && numero <= choix.length) {
      retenu = choix[numero - 1]
      noter('réponse choisie à la main', 'ok', `proposition ${numero}, forme ${forme(retenu)}`)
    } else if (faits.length > 0) {
      retenu = choiceForQuestion(question.value.question, choix, faits)
      if (retenu !== null) {
        noter('la réponse donnée correspond', 'ok', `forme ${forme(retenu)}`)
      } else {
        // Le compte porte sur ce qui **se lit comme une date**, et non sur ce qui contient un
        // chiffre : une classe s'écrit `1ERE G2`, et n'est pas une date.
        const dates = choix.filter((entree) => readDate(entree) !== undefined).length
        noter(
          'la réponse donnée correspond',
          'ko',
          `aucune des ${choix.length} propositions n’est cette réponse (${dates} se lisent comme des dates)`,
        )
      }
    }

    if (retenu === null) {
      const saisi = await demander('Numéro de la bonne réponse (vide pour arrêter) : ')
      const choisi = Number(saisi)
      if (!Number.isInteger(choisi) || choisi < 1 || choisi > choix.length) {
        console.log('\nRelance avec  --questions  pour voir les propositions, puis  --choix N.')
        return conclure()
      }
      retenu = choix[choisi - 1]
    }

    const repondu = await client.answerSecurityQuestion(retenu)
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

  /*
   * Cet appel ne se fait plus tout seul.
   *
   * Le 20 septembre 2026, ici même, le service y a répondu par son message d'activité
   * suspecte — « Nous avons enregistré votre adresse IP ainsi que l'ensemble des
   * informations relatives à vos requêtes » — alors que le jeton valait encore, puisque la
   * lecture juste après est passée. Insister à chaque essai, c'est se faire remarquer sur
   * un vrai compte pour éprouver une route dont on ne connaît pas la forme.
   *
   * `--renouvellement` la redemande, une fois, quand on cherche exprès à la comprendre.
   */
  if (option('renouvellement') !== undefined) {
    const avant = client.session.token
    const renouvele = await client.renewToken(client.session.userId ?? compte.id)
    // Le code compte plus que la phrase : c'est lui qui dit de quelle famille est le refus.
    const pourquoi = renouvele.ok ? '' : `${renouvele.diagnostic ?? 'sans code'} — ${renouvele.message}`
    noter('renewtoken.awp accepté', renouvele.ok ? 'ok' : 'ko', pourquoi)
    if (renouvele.ok) {
      const change = client.session.token !== null && client.session.token !== avant
      noter('un jeton neuf est rendu', change ? 'ok' : 'ko', change ? '' : 'le jeton n’a pas changé')
    }
  } else {
    noter('renewtoken.awp', 'skip', 'fermé : refusé par le service, relance avec --renouvellement')
  }

  // Le jeton sert-il vraiment ? Sans cette lecture, on ne sait rien.
  const devoirs = await api.homework(compte)
  noter('lecture après connexion', devoirs.ok ? 'ok' : 'ko', devoirs.ok ? `${devoirs.value.length} devoir(s)` : devoirs.message)

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

  const aVenir = devoirs.ok ? devoirs.value.map((devoir) => devoir.dueDate).sort()[0] : undefined
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
