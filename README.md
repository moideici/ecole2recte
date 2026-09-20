# ecole2recte — client web

Un client ÉcoleDirecte pour le navigateur, pensé pour l'ordinateur **et** le téléphone, et
pour les trois profils : élève, parent, professeur. Frère du client Android
[`ecole2rect`](https://github.com/moidefr/ecole2rect), dont il reprend le savoir
protocolaire — durement acquis — sans en reprendre le code.

> **État : P0 à P3 écrits, et l'espace professeur en lecture.** Le protocole, la lecture
> complète élève et famille, l'application, l'écriture documentée, et la lecture enseignant.
> Aucune écriture n'est **ouverte**, et rien de l'espace professeur n'a encore été vérifié sur
> un compte enseignant. Voir [ROADMAP.md](ROADMAP.md).

## Ce qui commande l'architecture

**1. L'API ne parle pas aux navigateurs.** Les clients publics qui l'ont essayé le constatent :
réponse 403 depuis une page web, aucun en-tête CORS pour une autre origine. Un mandataire côté
serveur est donc nécessaire — et c'est une chance déguisée : **le jeton et le mot de passe ne
descendent jamais jusqu'au navigateur**. `node tools/probe/probe.mjs` (sans compte, sans
identifiants) et `tools/probe/cors.html`, depuis un vrai navigateur, permettent de le revérifier.

**2. Un HTTP 200 ne veut pas dire que ça a marché.** Le vrai statut est dans le champ `code`
du corps JSON. Croire le statut HTTP est l'erreur fondatrice de tout client ÉcoleDirecte, et
elle se paie en écrans vides qu'on ne s'explique pas. Un test le vérifie explicitement.

**3. La version périme sans préavis.** Le paramètre `v=` suit les mises à jour du site ; le
jour où il ne convient plus, **toutes** les requêtes échouent d'un coup avec le code 517.
Elle est donc réglable sans redéployer, et le code 517 a son propre message.

## Organisation

| Dossier | Rôle |
|---|---|
| `packages/protocol/` | tout le savoir protocolaire : encodages, codes métier, session, client, appels élève, famille et enseignant. Zéro dépendance, tourne en Node comme dans un navigateur. |
| `tools/probe/` | sondage du service sans compte : la question CORS, et rien d'autre. |
| `apps/web/` | l'interface et le mandataire : onze pages élève et famille, sept pages professeur, ordinateur et téléphone, et un mode démonstration. |
| `tools/smoke/` | les allers-retours d'écriture sur un vrai compte, à lancer à la main. |
| `tools/har/` | extraction de la *forme* d'un endpoint depuis une capture réseau, sans les valeurs. |

Le jour où ÉcoleDirecte change, `packages/protocol/` est le seul endroit à reprendre.

## Ce que le protocole sait déjà faire

- **Connexion complète**, alignée sur les clients qui se connectent réellement en 2026 : jeton
  GTK (obligatoire depuis mars 2025 — sans lui le service répond « identifiant ou mot de passe
  incorrect », ce qui fait chercher très loin une panne très proche) redemandé avant **chaque**
  login, `login.awp`, capture des jetons `X-Token` et `2FA-Token` au vol.
- **Question de sécurité** : lecture de la question et des propositions (base64), envoi du
  choix, récupération du couple `cn`/`cv`. Le login qui conclut l'échange emporte les jetons
  obtenus pendant la question et renvoie le couple à la racine du corps **et** dans `fa` —
  avec `fa` seul, le service refuse une réponse pourtant juste. Le couple est ensuite
  réutilisable, donc conservable pour ne pas reposer la question à chaque connexion.
- **Renouvellement du jeton** sans repasser par le mot de passe (`renewtoken.awp`).
- **Comptes élève et famille** : un compte parent ne rend pas un élève mais une famille et
  ses enfants ; chaque enfant devient un profil complet, et la messagerie reste celle de la
  famille. Donner l'identifiant de la famille aux appels élève fait répondre « accès refusé »
  à tous.
- **Comptes professeur** (`typeCompte: "P"`), en lecture sur l'hôte `apip.ecoledirecte.com` :
  emploi du temps, catalogue des classes, groupes, périodes et matières, élèves d'une classe,
  cahier de textes, grille de notes, messagerie.
- **Les modules font foi** : la réponse de connexion dit ce que l'établissement a réellement
  ouvert. Aucune fonctionnalité n'est codée en dur par rôle.

## Les règles qui ne se négocient pas

- **Aucune protection n'est contournée.** La réponse à une question de sécurité n'est jamais
  devinée ni approchée : elle doit correspondre exactement à une proposition du serveur, et
  il n'y a pas de seconde tentative automatique.
- **Rien de secret ne sort.** Les traces de requêtes expurgent mot de passe, jetons et
  couple `cn`/`cv` ; un test échoue si l'un d'eux apparaît dans une trace.
- **Aucune capture réseau brute n'entre dans le dépôt.** Un fichier HAR porte le mot de passe
  en clair dans le corps du login et le `X-Token` dans chaque en-tête suivant : `*.har` et
  `captures/` sont ignorés par git.
- **Le mandataire n'est pas ouvert.** Il n'expose pas de route « transmets ce que je te
  donne » : chaque endpoint a sa route typée, sans quoi on publierait un relais anonyme vers
  ÉcoleDirecte.

## L'espace professeur

Un compte enseignant arrive sur `/prof` : accueil, emploi du temps, classes et élèves, cahier
de textes, notes, messagerie. **Tout y est en lecture seule.**

- Les formes des réponses viennent des clients qui lisent ces routes en réel ; elles sont
  figées dans des tests, mais **aucune n'a encore été confrontée à un compte enseignant de ce
  projet**. Le premier essai se fait avec un professeur volontaire qui se connecte lui-même.
- Les moyennes de la grille de notes sont **calculées** à partir de la grille, et le disent :
  celles du bulletin suivent les règles de l'établissement.
- Une classe ne s'ouvre que si elle appartient au professeur connecté, quelle que soit
  l'adresse demandée.
- Les photos d'élèves ne sont pas affichées : leur téléchargement n'est documenté nulle part.

Pour le montrer sans compte, `ED_DEMO=1` ajoute sur la page de connexion un accès à l'espace
professeur sur des données **entièrement inventées**, servies par un faux serveur local.
Aucune requête ne part vers ÉcoleDirecte depuis une session de démonstration.

## L'écriture, et comment elle sera éprouvée

Toute écriture passe par un **point de passage unique** (`EcoleDirecteClient.call`, option
`write`) gouverné par une police à trois états :

| Police | Effet |
|---|---|
| `deny` | **défaut.** La requête est construite, rien ne part. |
| `dry-run` | La requête est construite et tracée pour relecture, rien ne part. |
| `allow` | La requête part. |

Une fonction d'écriture ne passe en `allow` qu'après son **aller-retour réel** : l'action,
puis sa lecture depuis le serveur pour vérifier que ce qui est arrivé est bien ce qu'on a
envoyé. Le test d'envoi de message s'adresse **à soi-même** et compare le corps caractère par
caractère — c'est ce qui prouve qu'un accent, un retour à la ligne ou un message long ne sont
pas mutilés en route. Tant que cet aller-retour n'est pas vert, la fonction reste absente de
l'interface. Un professeur n'est pas une cible de test.

## Tu débutes ? Commence par [`DEMARRER/`](DEMARRER/)

Le dossier [`DEMARRER/`](DEMARRER/README.md) contient la liste de ce qu'il faut installer et
les étapes dans l'ordre, sans supposer de connaissances en développement. Un script prépare
tout : `bash DEMARRER/demarrer.sh`, ou `DEMARRER\demarrer.ps1` sous Windows.

## Développement

```sh
pnpm install
pnpm test        # sans réseau ni compte
pnpm typecheck
pnpm build
pnpm --filter @ecole2recte/web dev
ED_DEMO=1 pnpm --filter @ecole2recte/web dev   # avec l'espace professeur sur données inventées

pnpm probe       # sondage CORS, sans identifiants
pnpm har capture.har > forme.json   # la forme d'un endpoint, jamais ses valeurs
pnpm smoke       # les allers-retours d'écriture, sur un vrai compte, à la main
```

Copie `.env.example` en `.env`. En production, `SESSION_SECRET` est obligatoire : sans lui,
l'application refuse de sceller plutôt que de chiffrer avec une clé devinable.

### Comment c'est éprouvé

178 tests, sans réseau et sans compte — 163 pour le protocole, 15 pour l'application — sur
quatre niveaux :

1. **Ce qu'on envoie**, et pas seulement ce qu'on comprend. Chaque appel est figé — chemin,
   verbe, paramètres, corps, hôte — et le corps du login est comparé **au caractère près**.
   Côté enseignant, cela vaut jusqu'au séparateur `¤` encodé dans les routes de notes.
2. **Un vrai serveur HTTP factice**, à qui parle le vrai moteur `fetch`. Il éprouve ce qu'un
   moteur simulé ne verrait pas : deux `Set-Cookie` que `headers.get` recollerait en un
   seul, le User-Agent épinglé renvoyé à chaque appel, et le **HTTP 200 qui refuse**.
3. **Les lecteurs face à des réponses réalistes**, avec leurs variantes : une classe tantôt
   objet tantôt libellé, un « 12,5 » à virgule, une note « Abs » qui n'est pas un zéro, un
   contenu tantôt en base64 tantôt en clair. Aucun lecteur ne lève, même sur une réponse
   absurde.
4. **Les invariants qui protègent**. La police d'écriture bloque les cinq écritures et rien
   ne sort du moteur. Aucun mot de passe ni couple de confiance n'apparaît dans une trace. Une
   section qui échoue n'emporte pas les autres. Un sceau modifié d'une lettre est refusé.

La CI ajoute deux garde-fous qui ne sont pas des tests : aucune capture réseau versionnée,
et l'écriture fermée dans l'exemple de configuration — un fichier qui l'ouvrirait finirait
un jour copié tel quel en production.

## Ce qui n'est pas promis

- **L'envoi de message, la justification d'absence et le rendu de devoir en ligne** ne sont
  documentés nulle part publiquement. Ils demandent une observation du trafic réel, faite par
  la personne propriétaire du compte, sur son compte. Ils n'existeront pas avant.
- **L'écriture professeur** — saisie de notes, appel, cahier de textes — n'est documentée par
  aucune source récente fiable, et chacune touche le dossier scolaire d'élèves. Elle ne sera
  pas écrite avant d'avoir été observée et éprouvée avec un professeur, et avec l'accord de
  l'établissement.
- **Aucune limitation de débit n'est documentée.** L'implémentation est donc conservatrice
  par prudence, pas par savoir.
