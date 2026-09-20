import { type ApiErrorKind, type ApiResult, ApiCode, failure, kindForCode } from './codes.js'
import { type JsonValue, base64DecodeOrRaw, base64Encode, formBody } from './encoding.js'
import { type Account } from './models.js'
import { parseAccounts } from './parse/accounts.js'
import {
  type SessionState,
  type TrustedAnswer,
  DEFAULT_USER_AGENT,
  absorb,
  cookieHeader,
  createSession,
} from './session.js'
import { type BinaryResponse, type HttpEngine, type HttpRequest, NetworkFailure } from './transport.js'

export const DEFAULT_API_BASE = 'https://api.ecoledirecte.com/v3'
/** Les professeurs vivent sur un autre hôte. Prêt, mais rien ne l'utilise encore. */
export const DEFAULT_TEACHER_API_BASE = 'https://apip.ecoledirecte.com/v3'

/**
 * Ce que le client s'autorise à écrire.
 *
 * `deny` est le défaut, et ce n'est pas de la prudence décorative : une écriture jamais
 * éprouvée peut livrer un message tronqué à un professeur, ou rendre un devoir qu'on ne peut
 * pas reprendre. Une fonction d'écriture ne s'ouvre qu'après son aller-retour réel.
 */
export type WritePolicy = 'allow' | 'dry-run' | 'deny'

/** Trace d'une requête, expurgée : elle peut être journalisée. */
export interface RequestRecord {
  method: string
  url: string
  verb?: string
  write: boolean
  body: JsonValue
}

export interface ClientOptions {
  engine: HttpEngine
  session?: SessionState
  apiBase?: string
  teacherApiBase?: string
  userAgent?: string
  /**
   * En-tête `X-Client`. Le client Android envoie `Android` ; le site web, lui, n'envoie
   * probablement rien. Faute de pouvoir l'observer, on n'envoie rien par défaut et on laisse
   * le réglage ouvert — c'est la première chose que le sondage réel tranchera.
   */
  xClient?: string | null
  writePolicy?: WritePolicy
  onRequest?: (record: RequestRecord) => void
}

export interface CallOptions {
  verb?: 'get' | 'post' | 'put' | 'delete'
  query?: Record<string, string | number | boolean>
  body?: JsonValue
  host?: 'family' | 'teacher'
  auth?: boolean
  /** Marque l'appel comme modifiant l'état côté serveur : il passe par la police d'écriture. */
  write?: boolean
  /**
   * Interdit le renouvellement automatique du jeton pour cet appel.
   *
   * Posé sur `renewtoken.awp` lui-même — sans quoi un jeton refusé ferait tourner la
   * tentative de renouvellement sur elle-même — et sur le second essai, pour qu'il n'y en
   * ait jamais un troisième.
   */
  noRenew?: boolean
}

export type LoginOutcome =
  | { ok: true; accounts: Account[] }
  | { ok: false; kind: ApiErrorKind; message: string; diagnostic?: string }

export interface SecurityQuestion {
  question: string
  choices: string[]
}

const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
]

function sansAccent(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Une proposition lue comme une date, ou `undefined` si ce n'en est pas une. */
function dateDe(choix: string): string | undefined {
  const texte = choix.trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texte)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const francaise = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(texte)
  if (francaise) {
    return `${francaise[3]}-${String(francaise[2]).padStart(2, '0')}-${String(francaise[1]).padStart(2, '0')}`
  }

  const lettres = /^(\d{1,2})\s+([^\s]+)\s+(\d{4})$/.exec(texte)
  if (lettres) {
    const mois = MOIS.findIndex((nom) => sansAccent(nom) === sansAccent(lettres[2] as string))
    if (mois >= 0) {
      return `${lettres[3]}-${String(mois + 1).padStart(2, '0')}-${String(lettres[1]).padStart(2, '0')}`
    }
  }
  return undefined
}

/**
 * La proposition qui **est** cette date, s'il n'y en a qu'une.
 *
 * Ce n'est pas une réponse devinée : la date vient de la personne, et ce qui repart est la
 * proposition du serveur **telle quelle**, jamais une chaîne recomposée. Le service écrit
 * ses dates de plusieurs façons (`15/03/2009`, `15 mars 2009`, `2009-03-15`) ; les comparer
 * après lecture n'est pas approcher une réponse, c'est reconnaître la même valeur sous deux
 * écritures.
 *
 * Rien n'est rendu si **zéro ou plusieurs** propositions correspondent : dans le doute, la
 * question se pose comme avant. Il n'y a jamais de seconde tentative.
 */
export function choiceForDate(choices: string[], isoDate: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null
  const correspondances = choices.filter((choix) => dateDe(choix) === isoDate)
  return correspondances.length === 1 ? (correspondances[0] as string) : null
}

const SECRET_KEYS = new Set(['motdepasse', 'password', 'token', 'access_token', 'cn', 'cv', 'choix', 'fa'])

/** Remplace la valeur des clés sensibles : une trace ne doit jamais rejouer une connexion. */
function redactBody(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map((item) => redactBody(item))
  if (value === null || typeof value !== 'object') return value
  const out: Record<string, JsonValue> = {}
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) continue
    out[key] = SECRET_KEYS.has(key.toLowerCase()) ? '<expurgé>' : redactBody(item)
  }
  return out
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/**
 * Le client ÉcoleDirecte.
 *
 * Tout le savoir protocolaire tient ici et dans `parse/` : le jour où le service change,
 * c'est le seul endroit à reprendre. Le client ne connaît ni `fetch` ni le navigateur — il
 * reçoit un moteur, ce qui rend chaque requête sortante vérifiable sans réseau.
 */
export class EcoleDirecteClient {
  readonly session: SessionState

  private readonly engine: HttpEngine
  private readonly apiBase: string
  private readonly teacherApiBase: string
  private readonly xClient: string | null
  private readonly onRequest: ((record: RequestRecord) => void) | undefined

  writePolicy: WritePolicy

  constructor(options: ClientOptions) {
    this.engine = options.engine
    this.apiBase = options.apiBase ?? DEFAULT_API_BASE
    this.teacherApiBase = options.teacherApiBase ?? DEFAULT_TEACHER_API_BASE
    this.xClient = options.xClient ?? null
    this.writePolicy = options.writePolicy ?? 'deny'
    this.onRequest = options.onRequest
    this.session = options.session ?? createSession({ userAgent: options.userAgent ?? DEFAULT_USER_AGENT })
  }

  /**
   * En-têtes que le service exige d'un client qui « ressemble au site web ». Ce ne sont pas
   * des ornements : sans eux, les réponses changent.
   */
  private browserHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': this.session.userAgent,
      Accept: 'application/json, text/plain, */*',
      Origin: 'https://www.ecoledirecte.com',
      Referer: 'https://www.ecoledirecte.com/',
    }
    if (this.xClient !== null) headers['X-Client'] = this.xClient
    const cookies = cookieHeader(this.session)
    if (cookies) headers['Cookie'] = cookies
    return headers
  }

  private authHeaders(): Record<string, string> {
    const headers = this.browserHeaders()
    if (this.session.token) headers['X-Token'] = this.session.token
    if (this.session.twoFactorToken) headers['2FA-Token'] = this.session.twoFactorToken
    return headers
  }

  private url(path: string, options: CallOptions): string {
    const base = options.host === 'teacher' ? this.teacherApiBase : this.apiBase
    const params = new URLSearchParams()
    if (options.verb) params.set('verbe', options.verb)
    for (const [key, value] of Object.entries(options.query ?? {})) params.set(key, String(value))
    // `v` en dernier, comme le site : l'ordre des paramètres n'a jamais coûté cher à respecter.
    params.set('v', this.session.apiVersion)
    return `${base}${path}?${params.toString()}`
  }

  private async send(request: HttpRequest): Promise<ApiResult<unknown>> {
    let response
    try {
      response = await this.engine.send(request)
    } catch (error) {
      const message = error instanceof NetworkFailure ? error.message : 'Le service est injoignable.'
      return failure('network', message)
    }
    absorb(this.session, response.headers)

    let parsed: unknown
    try {
      parsed = JSON.parse(response.body)
    } catch {
      return failure(
        'protocol',
        "Le service a répondu autre chose que du JSON.",
        `statut ${response.status}, ${response.body.length} octets`,
      )
    }
    const body = asObject(parsed)
    if (!body) return failure('protocol', 'Réponse inattendue du service.')

    // Le champ `code` fait foi : un HTTP 200 ne dit rien de la réussite.
    const code = typeof body['code'] === 'number' ? (body['code'] as number) : response.status
    const token = body['token']
    if (typeof token === 'string' && token !== '') this.session.token = token
    if (code === ApiCode.OK) return { ok: true, value: body['data'] ?? null }

    const { kind, message } = kindForCode(code)
    const detail = typeof body['message'] === 'string' ? (body['message'] as string) : undefined
    return failure(kind, detail && detail !== '' ? detail : message, `code ${code}`)
  }

  /**
   * L'appel générique.
   *
   * Toute écriture passe par ici, et par la police d'écriture : c'est le point de passage
   * unique promis, celui qui permet de tout mettre en « répétition » avant le premier envoi
   * réel.
   */
  async call(path: string, options: CallOptions = {}): Promise<ApiResult<unknown>> {
    const body = options.body ?? {}
    const url = this.url(path, options)
    const write = options.write === true

    this.onRequest?.({ method: 'POST', url, verb: options.verb, write, body: redactBody(body) })

    if (write && this.writePolicy !== 'allow') {
      return this.writePolicy === 'dry-run'
        ? failure('dry-run', "Écriture construite mais non envoyée (mode répétition).", url)
        : failure('write-disabled', "Cette écriture n'est pas encore autorisée.", url)
    }

    const envoyer = () => {
      const headers = options.auth === false ? this.browserHeaders() : this.authHeaders()
      headers['Content-Type'] = 'application/x-www-form-urlencoded'
      return this.send({ method: 'POST', url, headers, body: formBody(body) })
    }

    const result = await envoyer()
    if (result.ok || result.kind !== 'session-expired') return result

    /*
     * Le jeton a expiré : on le renouvelle sans repasser par le mot de passe.
     *
     * Le service le fait tourner à chaque requête ; il suffit d'une pause pour qu'il périme,
     * et jusqu'ici cela se voyait comme une déconnexion brutale au milieu d'une consultation.
     *
     * Une seule fois, jamais en boucle. Et **on ne rejoue pas une écriture** : si le service
     * avait agi avant de répondre que le jeton ne vaut plus, la rejouer enverrait deux fois
     * le même commentaire ou créerait deux dossiers. Le jeton est quand même renouvelé, si
     * bien que le geste suivant passe — c'est le prix d'un doute qu'on ne peut pas lever.
     */
    if (options.noRenew === true || !this.session.userId) return result

    const renouvele = await this.renewToken(this.session.userId)
    if (!renouvele.ok) return result
    if (write) return failure('session-expired', 'La session a été renouvelée : recommence ce geste.')

    return this.call(path, { ...options, noRenew: true })
  }

  /**
   * Premier temps de la connexion : depuis mars 2025, sans jeton GTK le service répond
   * « identifiant ou mot de passe incorrect », ce qui envoie chercher très loin une panne
   * très proche.
   *
   * Le jeton est à usage unique. L'ancien est donc oublié avant d'en demander un neuf, en
   * en-tête comme en cookie : un jeton usé ne doit jamais repartir faute d'un nouveau.
   */
  async refreshGtk(): Promise<ApiResult<string>> {
    this.session.gtk = null
    delete this.session.cookies['GTK']
    const url = `${this.apiBase}/login.awp?gtk=1&v=${encodeURIComponent(this.session.apiVersion)}`
    let response
    try {
      response = await this.engine.send({ method: 'GET', url, headers: this.browserHeaders() })
    } catch {
      return failure('network', 'Le service est injoignable.')
    }
    absorb(this.session, response.headers)

    let body: Record<string, unknown> | null = null
    try {
      body = asObject(JSON.parse(response.body))
    } catch {
      // Corps vide ou illisible : le jeton est dans les en-têtes ou les cookies.
    }
    // Le jeton arrive en en-tête ou en cookie, et parfois dans le corps.
    const fromBody = typeof body?.['token'] === 'string' && body['token'] !== '' ? (body['token'] as string) : null
    const gtk = this.session.gtk ?? this.session.cookies['GTK'] ?? fromBody
    if (gtk) {
      this.session.gtk = gtk
      return { ok: true, value: gtk }
    }
    // Pas de jeton : avant de conclure au protocole, on regarde si le service a dit
    // pourquoi. Un 517 annoncé « jeton GTK absent » enverrait chercher au mauvais endroit.
    const code = typeof body?.['code'] === 'number' ? (body['code'] as number) : ApiCode.OK
    if (code !== ApiCode.OK) {
      const { kind, message } = kindForCode(code)
      return failure(kind, message, `code ${code}`)
    }
    return failure('protocol', "Le service n'a pas fourni de jeton GTK.")
  }

  /**
   * Le login.
   *
   * `answer` est le couple de confiance d'une question de sécurité, et il part sous deux
   * formes selon d'où il vient. Juste après avoir répondu (`fresh`), le site envoie `cn` et
   * `cv` à la racine **et** dans `fa` : avec `fa` seul, le service refuse une réponse pourtant
   * juste en annonçant un mot de passe invalide. Un couple mémorisé d'une connexion
   * précédente ne part que dans `fa`.
   */
  async login(
    identifier: string,
    password: string,
    answer?: TrustedAnswer,
    options: { fresh?: boolean } = {},
  ): Promise<LoginOutcome> {
    const gtk = await this.refreshGtk()
    if (!gtk.ok) return gtk

    // L'ordre des clés est celui du site, et il est reproduit tel quel : le corps est
    // sérialisé dans l'ordre d'insertion.
    const factors = answer ? [{ cn: answer.cn, cv: answer.cv, uniq: false }] : []
    const body: JsonValue =
      answer && options.fresh
        ? {
            identifiant: identifier,
            motdepasse: password,
            isReLogin: false,
            cn: answer.cn,
            cv: answer.cv,
            uuid: '',
            fa: factors,
          }
        : { identifiant: identifier, motdepasse: password, isReLogin: false, uuid: '', fa: factors }
    const url = `${this.apiBase}/login.awp?v=${encodeURIComponent(this.session.apiVersion)}`
    this.onRequest?.({ method: 'POST', url, write: false, body: redactBody(body) })

    // Comme le site, le login qui conclut une question de sécurité emporte les jetons obtenus
    // pendant l'échange. Une première connexion n'en a aucun, et n'envoie donc rien de plus.
    const headers = this.authHeaders()
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    headers['X-GTK'] = gtk.value

    const result = await this.send({ method: 'POST', url, headers, body: formBody(body) })
    if (!result.ok) return result
    const accounts = parseAccounts(result.value)
    // Le titulaire de la connexion, pour pouvoir renouveler le jeton sans le mot de passe.
    // C'est le compte principal — pour une famille, la famille, et non l'un des enfants.
    const titulaire = accounts.find((account) => account.familyId !== undefined)?.familyId ?? accounts[0]?.id
    if (titulaire) this.session.userId = titulaire
    return { ok: true, accounts }
  }

  /** Deuxième temps quand le service a répondu 250 : la question et ses propositions. */
  async securityQuestion(): Promise<ApiResult<SecurityQuestion>> {
    const result = await this.call('/connexion/doubleauth.awp', { verb: 'get' })
    if (!result.ok) return result
    const data = asObject(result.value)
    if (!data) return failure('protocol', 'Question de sécurité illisible.')
    const raw = data['propositions']
    const choices = (Array.isArray(raw) ? raw : [])
      .filter((choice): choice is string => typeof choice === 'string')
      .map((choice) => base64DecodeOrRaw(choice))
    const question = typeof data['question'] === 'string' ? base64DecodeOrRaw(data['question']) : ''
    return { ok: true, value: { question, choices } }
  }

  /**
   * Troisième temps : la réponse choisie.
   *
   * `choice` doit être **l'une des propositions rendues par le serveur**, à l'identique.
   * Le client ne devine jamais, n'approche jamais, et ne réessaie pas : une question de
   * sécurité est une protection, pas un obstacle à contourner.
   */
  async answerSecurityQuestion(choice: string): Promise<ApiResult<TrustedAnswer>> {
    const result = await this.call('/connexion/doubleauth.awp', {
      verb: 'post',
      body: { choix: base64Encode(choice) },
    })
    if (!result.ok) return result
    const data = asObject(result.value)
    const cn = data && typeof data['cn'] === 'string' ? (data['cn'] as string) : ''
    const cv = data && typeof data['cv'] === 'string' ? (data['cv'] as string) : ''
    if (cn === '' || cv === '') return failure('protocol', "Le service n'a pas validé la réponse.")
    return { ok: true, value: { cn, cv } }
  }

  // ——————————————————————————————————————————————————— téléchargement

  /** Le moteur sait-il rapporter des octets ? Sans lui, pas de pièce jointe. */
  engineForDownload(): ((request: HttpRequest) => Promise<BinaryResponse>) | null {
    const download = this.engine.download
    return download ? (request) => download.call(this.engine, request) : null
  }

  downloadUrl(fileId: string, fileType: string): string {
    const params = new URLSearchParams()
    params.set('verbe', 'get')
    params.set('fichierId', fileId)
    params.set('leTypeDeFichier', fileType)
    params.set('v', this.session.apiVersion)
    return `${this.apiBase}/telechargement.awp?${params.toString()}`
  }

  downloadHeaders(): Record<string, string> {
    const headers = this.authHeaders()
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    return headers
  }

  /**
   * Renouvelle le jeton sans repasser par le mot de passe. Le service fait tourner
   * `X-Token`, `2FA-Token` et les cookies d'un coup : ils sont tous repris au vol.
   */
  async renewToken(userId: string): Promise<ApiResult<unknown>> {
    return this.call('/renewtoken.awp', { verb: 'post', body: { idUser: userId, uuid: '' }, noRenew: true })
  }
}
