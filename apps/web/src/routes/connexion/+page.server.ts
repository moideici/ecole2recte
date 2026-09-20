import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import {
  type Account,
  type TrustedAnswer,
  EcoleDirecteClient,
  accountRole,
  createSession,
  fetchEngine,
  parseAccounts,
} from '@ecole2recte/protocol'
import { env } from '$env/dynamic/private'
import { DEMO_LOGIN, demoEnabled } from '$lib/server/demo.js'
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

    // Le couple de confiance n'est pas un mot de passe : c'est la preuve d'avoir répondu.
    // Il est scellé, et seulement s'il tient dans un cookie sans le faire déborder.
    const sealed = seal(answered.value)
    if (sealed.length < 3500) {
      cookies.set(CONFIANCE, sealed, {
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
        secure: secure(url),
        maxAge: 180 * 24 * 60 * 60,
      })
    }

    return await install(cookies, url, client, outcome.accounts)
  },

  /**
   * L'espace professeur sur données inventées. Une session de démonstration n'a ni jeton ni
   * identifiants, et son moteur ne parle qu'à un faux serveur local.
   */
  demo: async ({ cookies, url }) => {
    if (!demoEnabled()) return fail(404, { message: 'La démonstration n’est pas activée sur ce serveur.' })
    const accounts = parseAccounts(DEMO_LOGIN)
    const id = await sessions.create({
      protocol: createSession(),
      accounts,
      activeAccountId: accounts[0]?.id ?? null,
      awaitingSecurityAnswer: false,
      snapshots: {},
      demo: true,
    })
    setSessionCookie(cookies, id, secure(url))
    redirect(303, '/prof')
  },
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
