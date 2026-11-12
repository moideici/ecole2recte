import { env } from '$env/dynamic/private'
import { EcoleDirecteClient, createSession, fetchEngine } from '@ecole2recte/protocol'
import { seal, unseal } from './seal.js'
import { sessionSecret } from './secret.js'
import { type SessionRecord, sessions } from './store.js'

/**
 * Rouvrir une session expirée sans rien redemander.
 *
 * Le jeton d'ÉcoleDirecte tourne à chaque requête et meurt après une pause : jusqu'ici cela
 * se voyait comme une déconnexion en pleine consultation. `renewtoken.awp` serait la réponse
 * légère, mais le service l'a pris pour une activité suspecte — voir `write-policy.ts`. Reste
 * la connexion complète, dont l'aller-retour, lui, est éprouvé tous les jours.
 *
 * **Le danger n'est pas de se reconnecter, c'est de se reconnecter en rafale.** Un compte
 * réel a été bloqué par ÉcoleDirecte le 20 septembre 2026 après quelques connexions
 * rapprochées. Or une page en charge sept sections **en parallèle** : sur un jeton mort,
 * les sept échouent à la même seconde, et sans précaution ce sont sept connexions d'un coup.
 * Exactement le geste qui fait bloquer.
 *
 * D'où quatre verrous, et il faut les quatre :
 *
 *  1. **Une seule à la fois.** Les sept sections partagent une même promesse : la première
 *     se reconnecte, les six autres attendent son résultat.
 *  2. **Un délai de garde.** Jamais deux reconnexions à moins d'une minute d'écart.
 *  3. **Un plafond glissant.** Huit par heure — au-delà, quelque chose ne va pas, et
 *     insister ferait exactement le mal qu'on veut éviter. Par heure et non par session :
 *     une session « rester connecté » vit des semaines, et un plafond qui ne se remet
 *     jamais à zéro finirait par renvoyer au mot de passe un usage parfaitement normal.
 *  4. **Un mot de passe refusé efface tout.** Un mot de passe changé rejouerait sinon un
 *     mot de passe faux en boucle, ce qui est la façon la plus sûre de se faire bloquer.
 */

/** Une minute : en deçà, ce n'est plus une session qui reprend, c'est une boucle. */
export const DELAI_GARDE_MS = 60 * 1000

/** Huit reconnexions par heure. Un usage humain en demande deux ou trois par jour. */
export const PLAFOND = 8

/** La fenêtre du plafond. Passé ce délai sans reconnexion, le compte repart de zéro. */
export const FENETRE_MS = 60 * 60 * 1000

/**
 * Ce qu'on garde, scellé.
 *
 * Jamais en clair, jamais dans un cookie, jamais dans un journal : uniquement dans le
 * magasin de sessions, chiffré par `SESSION_SECRET`, et effacé avec la session.
 */
export interface Identifiants {
  identifier: string
  password: string
}

/**
 * La fonction est-elle disponible ?
 *
 * `SESSION_SECRET` est exigé, sans repli possible. `seal()` accepte en développement une clé
 * dérivée d'une chaîne fixe pour qu'on puisse lancer l'application sans rien configurer :
 * c'est acceptable pour un couple `cn`/`cv`, ça ne l'est pas pour un mot de passe. Sans vrai
 * secret, on ne garde rien — l'application marche, elle redemande le mot de passe.
 */
export function reconnexionDisponible(): boolean {
  if ((env['ED_REMEMBER'] ?? '1').trim() === '0') return false
  // Le vrai secret, ou — en développement local seulement — celui que `secret.ts` génère.
  return sessionSecret() !== undefined
}

/**
 * Les trois verrous temporels d'une reconnexion, partagés par la session et le coffre
 * d'appareil : délai de garde, plafond glissant, fenêtre. Rend le compteur à enregistrer
 * **avant** l'appel, ou `null` si le moment est mal choisi.
 */
export function prochaineReauth(
  precedent: { at: number; count: number } | undefined,
  maintenant = Date.now(),
): { at: number; count: number } | null {
  const avant = precedent ?? { at: 0, count: 0 }
  // Une heure sans reconnexion : ce n'est plus une rafale, c'est un usage. Le compte repart.
  const compteur = maintenant - avant.at > FENETRE_MS ? { at: avant.at, count: 0 } : avant
  if (compteur.count >= PLAFOND) return null
  if (maintenant - compteur.at < DELAI_GARDE_MS) return null
  return { at: maintenant, count: compteur.count + 1 }
}

/** Un client neuf, aligné sur la version d'API du service, qui ne peut rien écrire. */
export function clientDeReconnexion(session?: { userAgent: string; apiVersion: string }): EcoleDirecteClient {
  const client = new EcoleDirecteClient({
    engine: fetchEngine(),
    // Le jeton est lié au User-Agent qui l'a obtenu : en changer invaliderait le neuf.
    session: createSession(session ?? {}),
    // Rien ne s'écrit pendant une reconnexion : on rouvre une session, on n'agit pas.
    writePolicy: 'deny',
    ...(env['ED_API_BASE'] ? { apiBase: env['ED_API_BASE'] } : {}),
  })
  if (!session && env['ED_API_VERSION']) client.session.apiVersion = env['ED_API_VERSION']
  return client
}

/** Scelle les identifiants pour le magasin, ou rend `undefined` si on n'a pas le droit. */
export function retenirIdentifiants(identifier: string, password: string): string | undefined {
  if (!reconnexionDisponible()) return undefined
  return seal({ identifier, password } satisfies Identifiants)
}

/**
 * La fonction que le client appelle quand son jeton est mort.
 *
 * Elle rend `true` seulement si `record.protocol` porte désormais un jeton neuf — c'est le
 * contrat de `reauthenticate` : le client rejoue l'appel sur **le même objet de session**,
 * donc il faut le remplir sur place et non en rendre un autre.
 */
export function reconnecteur(id: string, record: SessionRecord): (() => Promise<boolean>) | undefined {
  if (record.demo || !record.remembered || !reconnexionDisponible()) return undefined
  return () => reconnecterUneFois(id, record)
}

/*
 * Les reconnexions en cours, par session.
 *
 * C'est le verrou qui compte le plus. Les sections d'une page partent ensemble et échouent
 * ensemble ; sans cette table, chacune lancerait la sienne. Elle ne couvre qu'une isolate,
 * mais c'est là que la rafale se produit — d'un onglet à l'autre, c'est le délai de garde
 * inscrit dans le magasin qui tient.
 */
const enCours = new Map<string, Promise<boolean>>()

function reconnecterUneFois(id: string, record: SessionRecord): Promise<boolean> {
  const dejaEnCours = enCours.get(id)
  if (dejaEnCours) return dejaEnCours

  const promesse = reconnecter(id, record).finally(() => enCours.delete(id))
  enCours.set(id, promesse)
  return promesse
}

async function reconnecter(id: string, record: SessionRecord): Promise<boolean> {
  const scelle = record.remembered
  if (!scelle) return false

  const suivante = prochaineReauth(record.reauth)
  if (!suivante) return false

  const identifiants = unseal<Identifiants>(scelle)
  // Sceau illisible — la clé a changé : inutile de réessayer, et rien à envoyer au service.
  if (!identifiants) {
    await oublier(id, record)
    return false
  }

  // Le compteur avance **avant** l'appel : si celui-ci n'aboutit jamais, le délai de garde
  // aura tout de même couru, et rien ne repartira dans la seconde.
  record.reauth = suivante
  await sessions.write(id, record)
  // Le coffre d'appareil partage le compteur : sans cela, une session qui vient de se
  // reconnecter laisserait le coffre en faire autant dans la minute.
  await synchroniserCoffre(record)

  const client = clientDeReconnexion({ userAgent: record.protocol.userAgent, apiVersion: record.protocol.apiVersion })

  const outcome = await client.login(identifiants.identifier, identifiants.password, record.trusted)

  if (!outcome.ok) {
    /*
     * Un mot de passe refusé n'est pas un incident passager.
     *
     * Ou il a changé, ou le couple de confiance ne vaut plus — dans les deux cas, rejouer
     * le même mot de passe faux est précisément ce qu'ÉcoleDirecte compte pour décider de
     * bloquer un compte. On oublie, et la personne se reconnecte à la main une fois.
     */
    if (outcome.kind === 'invalid-credentials' || outcome.kind === 'two-factor') await oublier(id, record)
    return false
  }

  // Le contrat : remplir **sur place** la session que le client tient déjà.
  Object.assign(record.protocol, client.session)
  record.accounts = outcome.accounts
  await sessions.write(id, record)
  return true
}

/** Efface ce qu'on gardait, sans fermer la session en cours — coffre d'appareil compris. */
async function oublier(id: string, record: SessionRecord): Promise<void> {
  delete record.remembered
  if (record.appareil) {
    await sessions.destroy(record.appareil)
    delete record.appareil
  }
  await sessions.write(id, record)
}

async function synchroniserCoffre(record: SessionRecord): Promise<void> {
  if (!record.appareil || !record.reauth) return
  const coffre = await sessions.read(record.appareil)
  if (!coffre) return
  coffre.reauth = record.reauth
  await sessions.write(record.appareil, coffre)
}
