import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import {
  type Account,
  type TrustedAnswer,
  EcoleDirecteClient,
  accountRole,
  choiceForQuestion,
  createSession,
  fetchEngine,
  parseAccounts,
} from '@ecole2recte/protocol'
import { env } from '$env/dynamic/private'
import { DEMO_LOGIN, DEMO_STUDENT_LOGIN, demoEnabled } from '$lib/server/demo.js'
import { seal, unseal } from '$lib/server/seal.js'
import { setSessionCookie } from '$lib/server/session.js'
import { sessions } from '$lib/server/store.js'
import { writePolicy } from '$lib/server/write-policy.js'

const CONFIANCE = 'e2r_confiance'

function secure(url: URL): boolean {
  return url.protocol === 'https:'
}

function newClient(): EcoleDirecteClient {
  const client = new EcoleDirecteClient({
    engine: fetchEngine(),
    session: createSession(),
    writePolicy: writePolicy(),
    apiBase: env['ED_API_BASE'] ?? undefined,
  })
  if (env['ED_API_VERSION']) client.session.apiVersion = env['ED_API_VERSION']
  return client
}

export const load: PageServerLoad = ({ locals }) => {
  if (locals.session && locals.session.accounts.length > 0) redirect(303, '/')
  return { demo: demoEnabled() }
}

/**
 * La connexion, et sa question de sécurité.
 *
 * Deux règles tiennent tout : la réponse n'est **jamais devinée** — les propositions
 * affichées sont exactement celles du serveur, et c'est la personne qui choisit — et il n'y
 * a **pas de réessai en chaîne**. Une question de sécurité est une protection, pas un
 * obstacle à contourner.
 */
export const actions: Actions = {
  connexion: async ({ request, cookies, url }) => {
    const form = await request.formData()
    const identifiant = String(form.get('identifiant') ?? '').trim()
    const motdepasse = String(form.get('motdepasse') ?? '')
    if (identifiant === '' || motdepasse === '') {
      return fail(400, { message: 'Identifiant et mot de passe sont attendus.' })
    }

    /*
     * Ce qu'on donne d'avance pour répondre à la question de sécurité.
     *
     * Deux faits, parce que le service **tire une question au hasard à chaque connexion** :
     * l'année de naissance, le jour, le mois, la date entière, ou la classe. Une réponse
     * unique ne pouvait donc pas convenir — c'est un compte réel qui l'a montré.
     *
     * Ils ne sortent pas de cet échange : ni journalisés, ni conservés, ni mis en cookie —
     * le traitement du mot de passe.
     */
    const faits = [String(form.get('naissance') ?? ''), String(form.get('classe') ?? '')]
      .map((entree) => entree.trim())
      .filter((entree) => entree !== '')

    const client = newClient()
    // Un couple de confiance déjà validé évite de reposer la question à chaque connexion.
    const confiance = unseal<TrustedAnswer>(cookies.get(CONFIANCE))
    let outcome = await client.login(identifiant, motdepasse, confiance ?? undefined)

    // Un couple de confiance périmé fait annoncer un mot de passe invalide à un mot de passe
    // juste. On l'oublie et on retente une seule fois sans lui : au pire, ÉcoleDirecte repose
    // sa question, ce qui est le comportement attendu d'un appareil qu'il ne reconnaît plus.
    if (!outcome.ok && outcome.kind === 'invalid-credentials' && confiance) {
      cookies.delete(CONFIANCE, { path: '/' })
      outcome = await client.login(identifiant, motdepasse)
    }

    if (outcome.ok) {
      return await install(cookies, url, client, outcome.accounts)
    }

    if (outcome.kind !== 'two-factor') {
      return fail(401, { message: outcome.message })
    }

    const question = await client.securityQuestion()
    if (!question.ok) return fail(502, { message: question.message })

    /*
     * La question, répondue par ce qui a été donné d'avance — si cela y répond.
     *
     * Rien n'est deviné : les faits viennent de la personne, et ce qui part est **la
     * proposition du serveur**, à l'identique. La question sert seulement à savoir quelle
     * part du fait est demandée. Il faut qu'exactement une proposition corresponde ; sinon
     * on pose la question comme avant. Une seule tentative : un échec renvoie à la page de
     * connexion.
     */
    const evidence =
      faits.length === 0 ? null : choiceForQuestion(question.value.question, question.value.choices, faits)
    if (evidence !== null) {
      const repondu = await client.answerSecurityQuestion(evidence)
      if (!repondu.ok) return fail(401, { message: repondu.message })

      const conclu = await client.login(identifiant, motdepasse, repondu.value, { fresh: true })
      if (!conclu.ok) return fail(401, { message: conclu.message })

      retenirConfiance(cookies, url, repondu.value)
      return await install(cookies, url, client, conclu.accounts)
    }

    // Le mot de passe reste en mémoire du serveur le temps de l'échange, et **uniquement**
    // ce temps : il faut le rejouer avec le couple de confiance pour finir la connexion.
    // Il est effacé dès que la réponse est validée, et n'est jamais écrit sur disque.
    const id = await sessions.create({
      protocol: client.session,
      accounts: [],
      activeAccountId: null,
      awaitingSecurityAnswer: true,
      pending: { identifier: identifiant, password: motdepasse },
      snapshots: {},
    })
    setSessionCookie(cookies, id, secure(url))

    return { question: question.value.question, propositions: question.value.choices }
  },

  question: async ({ request, cookies, url, locals }) => {
    const form = await request.formData()
    const choix = String(form.get('choix') ?? '')
    if (choix === '') return fail(400, { message: 'Choisis une réponse.' })

    const id = locals.sessionId
    const record = locals.session
    if (!id || !record || !record.awaitingSecurityAnswer) {
      return fail(440, { message: 'La connexion a expiré. Recommence.' })
    }
    const attente = record.pending
    if (!attente) return fail(440, { message: 'La connexion a expiré. Recommence.' })

    const client = new EcoleDirecteClient({
      engine: fetchEngine(),
      session: record.protocol,
      writePolicy: writePolicy(),
      apiBase: env['ED_API_BASE'] ?? undefined,
    })

    // Le choix envoyé est l'une des propositions du serveur, à l'identique. Une seule
    // tentative : si elle échoue, on repart de la page de connexion.
    const answered = await client.answerSecurityQuestion(choix)
    if (!answered.ok) {
      await sessions.destroy(id)
      return fail(401, { message: answered.message })
    }

    // `fresh` : juste après la réponse, le couple part à la racine du corps et dans `fa`.
    const outcome = await client.login(attente.identifier, attente.password, answered.value, { fresh: true })
    // La session d'attente disparaît avec le mot de passe qu'elle portait, réussite ou non.
    await sessions.destroy(id)
    if (!outcome.ok) return fail(401, { message: outcome.message })

    retenirConfiance(cookies, url, answered.value)

    return await install(cookies, url, client, outcome.accounts)
  },

  /**
   * L'application sur données inventées, côté élève ou côté professeur. Une session de
   * démonstration n'a ni jeton ni identifiants, et son moteur ne parle qu'à un faux serveur
   * local : rien ne part vers ÉcoleDirecte.
   */
  demo: async ({ request, cookies, url }) => {
    if (!demoEnabled()) return fail(404, { message: 'La démonstration n’est pas activée sur ce serveur.' })
    const form = await request.formData()
    const prof = String(form.get('profil') ?? 'eleve') === 'prof'
    const accounts = parseAccounts(prof ? DEMO_LOGIN : DEMO_STUDENT_LOGIN)
    const id = await sessions.create({
      protocol: createSession(),
      accounts,
      activeAccountId: accounts[0]?.id ?? null,
      awaitingSecurityAnswer: false,
      snapshots: {},
      demo: true,
    })
    setSessionCookie(cookies, id, secure(url))
    redirect(303, prof ? '/prof' : '/')
  },
}

/**
 * Le couple de confiance n'est pas un mot de passe : c'est la preuve d'avoir répondu.
 * Il est scellé, et seulement s'il tient dans un cookie sans le faire déborder.
 */
function retenirConfiance(cookies: import('@sveltejs/kit').Cookies, url: URL, answer: TrustedAnswer): void {
  const sealed = seal(answer)
  if (sealed.length >= 3500) return
  cookies.set(CONFIANCE, sealed, {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: secure(url),
    maxAge: 180 * 24 * 60 * 60,
  })
}

async function install(
  cookies: import('@sveltejs/kit').Cookies,
  url: URL,
  client: EcoleDirecteClient,
  accounts: Account[],
): Promise<never> {
  if (accounts.length === 0) {
    // Une connexion sans profil lisible n'est pas une réussite, quoi qu'en dise le code 200.
    throw redirect(303, '/connexion?vide=1')
  }
  // Le profil ouvert d'abord : un élève ou un enseignant, plutôt qu'un rôle que l'application
  // ne sait pas montrer.
  const active = accounts.find((account) => accountRole(account) !== 'unknown') ?? accounts[0]
  const id = await sessions.create({
    protocol: client.session,
    accounts,
    activeAccountId: active?.id ?? null,
    awaitingSecurityAnswer: false,
    snapshots: {},
  })
  setSessionCookie(cookies, id, secure(url))
  redirect(303, active && accountRole(active) === 'teacher' ? '/prof' : '/')
}
