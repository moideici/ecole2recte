import type { Cookies } from '@sveltejs/kit'
import { accountRole, type Account, type TrustedAnswer } from '@ecole2recte/protocol'
import {
  clientDeReconnexion,
  prochaineReauth,
  reconnexionDisponible,
  type Identifiants,
} from './reconnexion.js'
import { avecReessais, pauseActive, pauseApres, type Pause } from './pause.js'
import { unseal } from './seal.js'
import { setSessionCookie } from './session.js'
import { COFFRE_TTL_MS, sessions, type SessionRecord } from './store.js'

/**
 * Le coffre d'appareil : ne plus avoir à se reconnecter.
 *
 * **Le problème.** « Rester connecté » gardait les identifiants scellés *dans la session*.
 * Quand la session disparaissait — expiration, redéploiement, éviction du Durable Object,
 * cookie perdu — les identifiants partaient avec elle, et il fallait tout retaper, question
 * de sécurité comprise (le couple `cn`/`cv` n'était gardé que dans la session, lui aussi).
 *
 * **La réponse.** Un second enregistrement, **indépendant de la session**, indexé par un
 * identifiant d'appareil aléatoire que seul ce navigateur détient (cookie `httpOnly`, un an
 * glissant). Il contient les identifiants scellés (AES-256-GCM, `SESSION_SECRET`) et le couple
 * de confiance. Une session perdue se rouvre donc toute seule, sans mot de passe ni question.
 *
 * **Ce que ça ne change pas.** Le mot de passe ne descend jamais au navigateur : le cookie
 * n'est qu'un identifiant opaque, comme celui de la session. Et les garde-fous de
 * `reconnexion.ts` s'appliquent à l'identique — une reconnexion à la fois, une minute de
 * garde, huit par heure, et un mot de passe refusé efface tout au lieu de boucler.
 */

export const COOKIE_APPAREIL = 'e2r_appareil'

const UN_AN_S = 365 * 24 * 60 * 60

/** Une session ouverte depuis le coffre il y a moins de deux minutes est réutilisée, pas doublée. */
const REEMPLOI_MS = 2 * 60 * 1000

function poserCookie(cookies: Cookies, id: string, secure: boolean): void {
  cookies.set(COOKIE_APPAREIL, id, {
    path: '/',
    httpOnly: true,
    // `lax` : le coffre doit suivre un simple lien, comme la session — voir `session.ts`.
    sameSite: 'lax',
    secure,
    maxAge: UN_AN_S,
  })
}

/**
 * Garde les identifiants scellés et le couple de confiance pour cet appareil, ou oublie
 * l'appareil si la personne n'a pas demandé à rester connectée. Rend l'identifiant du coffre.
 */
export async function retenirAppareil(
  cookies: Cookies,
  url: URL,
  remembered: string | undefined,
  trusted?: TrustedAnswer,
): Promise<string | undefined> {
  const existant = cookies.get(COOKIE_APPAREIL)
  if (!remembered) {
    // Décoché à cette connexion : plus rien ne doit rester pour cet appareil.
    await oublierAppareil(cookies)
    return undefined
  }
  const secure = url.protocol === 'https:'
  if (existant) {
    const coffre = await sessions.read(existant)
    if (coffre?.coffre) {
      coffre.remembered = remembered
      if (trusted) coffre.trusted = trusted
      // Une connexion faite à la main lève la pause (la question de sécurité est résolue).
      delete coffre.pause
      await sessions.write(existant, coffre)
      poserCookie(cookies, existant, secure)
      return existant
    }
  }
  const id = await sessions.create({
    // Un coffre n'est pas une session : ces champs sont là pour satisfaire la forme commune.
    protocol: { gtk: null, token: null, twoFactorToken: null, cookies: {}, userAgent: '', apiVersion: '' },
    accounts: [],
    activeAccountId: null,
    awaitingSecurityAnswer: false,
    snapshots: {},
    coffre: true,
    remembered,
    ...(trusted ? { trusted } : {}),
  })
  poserCookie(cookies, id, secure)
  return id
}

/** Efface le coffre et le cookie : déconnexion, « Oublier cet appareil », identifiants refusés. */
export async function oublierAppareil(cookies: Cookies): Promise<void> {
  const id = cookies.get(COOKIE_APPAREIL)
  if (id) await sessions.destroy(id)
  cookies.delete(COOKIE_APPAREIL, { path: '/' })
}

/** Ce que Réglages montre : le coffre existe-t-il, et quand a-t-il servi pour la dernière fois ? */
export async function etatCoffre(
  record: SessionRecord,
): Promise<{ present: boolean; derniere: number | null; expireLe: number | null; pause: Pause | null }> {
  if (!record.appareil) return { present: false, derniere: null, expireLe: null, pause: null }
  const coffre = await sessions.read(record.appareil)
  if (!coffre?.coffre) return { present: false, derniere: null, expireLe: null, pause: null }
  return {
    present: true,
    pause: pauseActive(coffre.pause) ? coffre.pause : null,
    derniere: coffre.reauth?.at ?? null,
    expireLe: coffre.touchedAt + COFFRE_TTL_MS,
  }
}

/** Le profil ouvert d'abord : un élève ou un enseignant, plutôt qu'un rôle qu'on ne sait pas montrer. */
export function compteInitial(accounts: Account[]): Account | undefined {
  return accounts.find((compte) => accountRole(compte) !== 'unknown') ?? accounts[0]
}

/*
 * Les réouvertures en cours, par coffre : une page et ses données partent ensemble, et sans
 * cette table chacune lancerait sa propre connexion — la rafale que tout ce dispositif existe
 * pour empêcher.
 */
const enCours = new Map<string, Promise<{ id: string; record: SessionRecord } | null>>()

/**
 * Rouvre une session perdue à partir du coffre de l'appareil. Rend la nouvelle session, ou
 * `null` — auquel cas la personne voit la page de connexion, comme avant.
 */
export function rouvrirDepuisCoffre(
  cookies: Cookies,
  url: URL,
): Promise<{ id: string; record: SessionRecord } | null> {
  const id = cookies.get(COOKIE_APPAREIL)
  if (!id || !reconnexionDisponible()) return Promise.resolve(null)
  const deja = enCours.get(id)
  if (deja) return deja
  const promesse = rouvrir(id, cookies, url).finally(() => enCours.delete(id))
  enCours.set(id, promesse)
  return promesse
}

async function rouvrir(
  idCoffre: string,
  cookies: Cookies,
  url: URL,
): Promise<{ id: string; record: SessionRecord } | null> {
  const secure = url.protocol === 'https:'
  const coffre = await sessions.read(idCoffre)
  if (!coffre?.coffre || !coffre.remembered) {
    // Cookie orphelin (coffre expiré ou effacé) : on n'en garde pas la trace.
    cookies.delete(COOKIE_APPAREIL, { path: '/' })
    return null
  }

  // Le disjoncteur : blocage, demande de patienter, ou question de sécurité en attente.
  // Rien ne part vers ÉcoleDirecte tant que la pause dure.
  if (pauseActive(coffre.pause)) return null

  // Une requête parallèle, ou un autre onglet, vient peut-être déjà de rouvrir la session.
  if (coffre.derniere && Date.now() - coffre.derniere.at < REEMPLOI_MS) {
    const recente = await sessions.read(coffre.derniere.id)
    if (recente && recente.accounts.length > 0 && !recente.expired) {
      setSessionCookie(cookies, coffre.derniere.id, secure, true)
      return { id: coffre.derniere.id, record: recente }
    }
  }

  const suivante = prochaineReauth(coffre.reauth)
  // Trop tôt, ou plafond atteint : on ne force pas, la page de connexion prendra le relais.
  if (!suivante) return null

  const identifiants = unseal<Identifiants>(coffre.remembered)
  if (!identifiants) {
    // Sceau illisible — la clé a changé : rien à rejouer, rien à envoyer au service.
    await oublierAppareil(cookies)
    return null
  }

  // Le compteur avance **avant** l'appel : si celui-ci n'aboutit jamais, le délai de garde
  // aura tout de même couru.
  coffre.reauth = suivante
  await sessions.write(idCoffre, coffre)

  const client = clientDeReconnexion()
  // Seule une panne passagère est rejouée (trois essais espacés) ; tout refus s'arrête là.
  const issue = await avecReessais(() => client.login(identifiants.identifier, identifiants.password, coffre.trusted))

  if (!issue.ok) {
    // Mot de passe refusé : rejouer le même mot de passe faux est ce qu'ÉcoleDirecte compte
    // pour bloquer un compte. On oublie tout, et la personne se reconnecte à la main.
    if (issue.kind === 'invalid-credentials') {
      await oublierAppareil(cookies)
      return null
    }
    // Blocage, adresse refusée, demande de patienter, question de sécurité : le coffre est
    // **gardé** et mis en pause. Il n'est pas faux, il n'est juste pas le moment.
    const pause = pauseApres(issue)
    if (pause) {
      coffre.pause = pause
      await sessions.write(idCoffre, coffre)
    }
    // Une panne réseau laisse le coffre intact, sans pause : le délai de garde suffit.
    return null
  }
  delete coffre.pause
  if (issue.accounts.length === 0) return null

  const actif = compteInitial(issue.accounts)
  const record = {
    protocol: client.session,
    accounts: issue.accounts,
    activeAccountId: actif?.id ?? null,
    awaitingSecurityAnswer: false,
    snapshots: {},
    ...(coffre.trusted ? { trusted: coffre.trusted } : {}),
    remembered: coffre.remembered,
    appareil: idCoffre,
    // Même compteur que le coffre : la session ne doit pas se reconnecter dans la foulée.
    reauth: suivante,
  } satisfies Omit<SessionRecord, 'createdAt' | 'touchedAt'>
  const id = await sessions.create(record)

  coffre.derniere = { id, at: Date.now() }
  await sessions.write(idCoffre, coffre)
  setSessionCookie(cookies, id, secure, true)
  poserCookie(cookies, idCoffre, secure)

  const complet = await sessions.read(id)
  return complet ? { id, record: complet } : null
}
