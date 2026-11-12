# ecole2recte — client web

> Ce dépôt (`ecole2recte`) est le client **web** (monorepo pnpm). L'**application Android** est dans [ecole2rect](https://github.com/moideici/ecole2rect).

Un client ÉcoleDirecte pour le navigateur, pensé pour l'ordinateur **et** le téléphone, et
pour les trois profils : élève, parent, professeur. Frère du client Android
[`ecole2rect`](https://github.com/moideici/ecole2rect), dont il reprend le savoir
protocolaire — durement acquis — sans en reprendre le code.

> **État : P0 à P3 écrits, et l'espace professeur en lecture.** Le protocole, la lecture
> complète élève et famille, l'application, l'écriture documentée, et la lecture enseignant.
> **Quatre écritures sont ouvertes en production** — cocher et commenter un devoir, créer un
> dossier, renommer un fichier — à la demande du propriétaire du dépôt et **avant** leur
> aller-retour réel ; la suppression de fichier reste fermée. Rien de l'espace professeur n'a
> encore été vérifié sur un compte enseignant. Voir [ROADMAP.md](ROADMAP.md).

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
| `apps/web/` | l'interface et le mandataire : douze pages élève et famille dont un accueil en widgets, sept pages professeur, ordinateur et téléphone, et un mode démonstration. Tourne en Worker Cloudflare. Bandeau, sections à gauche, emploi du temps en grille, relevé de notes dépliable — les habitudes d'un logiciel de vie scolaire, parce qu'on cherche « Notes » là où on a toujours cliqué. |
| `apps/sessions/` | le Durable Object qui garde les sessions vivantes entre deux requêtes sur Cloudflare — voir « Déploiement ». |
| `tools/smoke/` | les allers-retours d'écriture sur un vrai compte, à lancer à la main. |
| `tools/verifier/` | la vérification **en lecture seule** sur un vrai compte : la réponse de sécurité donnée d'avance, le renouvellement du jeton, la chaîne complète. À lancer à la main. |
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
- **Renouvellement du jeton** sans repasser par le mot de passe (`renewtoken.awp`), et
  **automatique** : le jeton tourne à chaque requête et une pause suffit à le périmer, ce qui
  se voyait jusqu'ici comme une déconnexion en pleine consultation. Une lecture refusée pour
  jeton expiré est donc renouvelée puis rejouée **une seule fois**. Une **écriture** ne l'est
  pas : si le service avait agi avant d'annoncer que le jeton ne vaut plus, la rejouer
  enverrait deux fois le même commentaire. Le jeton est renouvelé quand même, si bien que le
  geste suivant passe.
- **Comptes élève et famille** : un compte parent ne rend pas un élève mais une famille et
  ses enfants ; chaque enfant devient un profil complet, et la messagerie reste celle de la
  famille. Donner l'identifiant de la famille aux appels élève fait répondre « accès refusé »
  à tous.
- **Comptes professeur** (`typeCompte: "P"`), en lecture sur l'hôte `apip.ecoledirecte.com` :
  emploi du temps, catalogue des classes, groupes, périodes et matières, élèves d'une classe,
  cahier de textes, grille de notes, messagerie.
- **Les modules font foi** : la réponse de connexion dit ce que l'établissement a réellement
  ouvert. Aucune fonctionnalité n'est codée en dur par rôle.

## Le cahier de textes se lit en deux temps, et l'application fait les deux

Le résumé (`cahierdetexte.awp`) dit **quelles** matières ont du travail pour une date. Il ne
dit **pas lequel** : les énoncés, les pièces jointes et le contenu de séance n'arrivent
qu'avec le détail d'un jour (`cahierdetexte/{date}.awp`). C'est voulu côté service — charger
l'année entière avec les énoncés serait énorme.

Une application qui ne lit que le résumé affiche donc « Mathématiques, pour mardi » et rien
d'autre, ce qui est exactement l'information dont on n'a pas besoin. Les journées se chargent
donc à part, en parallèle et en cache : celles du travail qui vient pour la liste et le fil
d'accueil, et la sienne pour la fiche d'une journée. **Un devoir, un cours de l'emploi du
temps et une ligne du fil mènent tous à cette fiche**, qui porte l'énoncé complet, les pièces
jointes, ce qui a été fait en classe et les cours de la journée.

## L'accueil est une disposition, pas une page

L'accueil n'a pas de contenu à lui : c'est une suite de **widgets** que la personne choisit —
lesquels, et dans quel ordre. Par défaut : la journée, où aller, le travail à faire, la
moyenne générale, les dernières notes, la vie scolaire, les messages. Vingt-six tuiles au
catalogue, réparties en six familles.

Deux conséquences qui ont décidé de l'implémentation :

- **La disposition vit dans un cookie, pas dans le navigateur.** Le serveur doit la connaître
  **avant** de charger quoi que ce soit : un accueil sans notes n'appelle pas les notes, et un
  accueil vide n'appelle rien. Avec un stockage côté navigateur il faudrait tout charger puis
  en jeter la moitié, et la page clignoterait le temps de remettre les tuiles dans l'ordre.
- **Tout se règle par formulaire**, flèches comprises : l'accueil se réordonne sans une ligne
  de JavaScript, et une tuile dont le module est fermé n'est pas proposée.

La journée, elle, est à l'échelle du temps : **la hauteur est la durée**. Une liste met toutes
les heures à la même hauteur — un cours de deux heures y ressemble à un cours d'une heure, et
un trou ne se voit pas du tout.

## La moyenne, et quand l'application refait le calcul

**Le bulletin prime.** La moyenne publiée par l'établissement s'affiche telle quelle : tous les
coefficients ne sont pas exposés, et les règles de calcul lui appartiennent. Une moyenne
calculée ici s'annonce toujours comme telle.

**Sauf quand elle est en retard.** Une moyenne publiée est un instantané, et la note saisie
hier n'y est pas toujours. L'afficher revient alors à **cacher la dernière note** — précisément
celle qu'on est venu voir. ÉcoleDirecte n'expose aucune date de calcul ; la seule façon de le
savoir sans la deviner est de retirer les notes une à une, de la plus récente à la plus
ancienne, et de regarder si la moyenne publiée réapparaît. Si oui, elle a été calculée avant
celles qu'on vient d'ôter : l'application affiche alors la sienne, marquée « recalculée », et
**dit laquelle manquait**. Le jour où le bulletin rattrape, il reprend la main tout seul.

Trois garde-fous, sans lesquels la règle deviendrait un prétexte à recalculer tout le temps :

- Un écart **inexpliqué** ne recalcule rien. Si aucun retrait ne retombe sur la moyenne
  publiée, c'est un coefficient caché ou une règle maison, pas un retard : le bulletin a raison.
- L'arrondi du bulletin n'est pas un désaccord. « 14,3 » et 14,26 sont la même moyenne.
- Une note **sans date** n'est jamais dite postérieure à quoi que ce soit.

La moyenne générale suit les mêmes règles, et se fait comme le bulletin la fait : une moyenne
des moyennes de matières, pondérée par leur coefficient — pas une moyenne à plat des notes,
qui ferait peser une matière à six devoirs trois fois plus qu'une matière à deux.

## Les règles qui ne se négocient pas

- **Aucune protection n'est contournée.** La réponse à une question de sécurité n'est jamais
  devinée ni approchée : elle doit correspondre exactement à une proposition du serveur, et
  il n'y a pas de seconde tentative automatique.

  La page de connexion accepte, **facultativement**, la date de naissance et la classe. Ce
  n'est pas une entorse, et voici pourquoi : les faits viennent de la personne, jamais du
  code ; ce qui repart est **la proposition du serveur telle quelle**, jamais une chaîne
  recomposée ; il faut qu'**exactement une** proposition corresponde, sinon la question se
  pose comme avant ; et il n'y a qu'une tentative.

  Deux champs et non un seul, parce qu'un compte réel l'a imposé : **le service tire sa
  question au hasard à chaque connexion** — « Quelle est votre année de naissance ? », puis
  « Quel est votre jour de naissance ? » à la connexion suivante, ailleurs « Quelle est votre
  classe ? ». La question sert donc à savoir **quelle part** du fait est demandée : l'année,
  le quantième, le mois — en chiffres ou en lettres —, la date entière. Lire la question pour
  cela n'est pas deviner la réponse.

  Le rapprochement reste strict : une date est comparée comme une date, quelle que soit son
  écriture ; tout le reste est comparé à l'identique, à la casse, aux accents et aux espaces
  près. Ni ressemblance, ni recherche par morceaux — `G2` ne répond pas pour `1ERE G2`. Les
  faits ne sortent pas de l'échange : ni journalisés, ni conservés, ni mis en cookie.

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

Pour le montrer sans compte, `ED_DEMO=1` ajoute sur la page de connexion deux accès — espace
élève et espace professeur — sur des données **entièrement inventées**, servies par un faux
serveur local. Aucune requête ne part vers ÉcoleDirecte depuis une session de démonstration.

La démonstration élève fabrique **exprès** le cas de la moyenne en retard : une matière dont la
moyenne publiée ignore la dernière note, et une autre sans moyenne publiée du tout. Une
démonstration prouve quelque chose ou ne sert à rien.

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
pas mutilés en route. Un professeur n'est pas une cible de test.

**Ce qui est ouvert en production**, dans `apps/web/wrangler.toml` : cocher un devoir,
commenter un devoir, créer un dossier, renommer un fichier. `cloud-delete` reste fermée —
une suppression ne se défait pas. Ces quatre-là ont été ouvertes **à la demande du
propriétaire du dépôt, avant leur aller-retour réel** : c'est sa décision et elle est
consignée ici, pas un feu vert du projet. L'exemple de configuration, lui, reste fermé : un
fichier qui ouvrirait l'écriture finirait un jour copié tel quel ailleurs, et la CI le
vérifie.

Trois verrous gardent chaque geste, et il les faut tous : la **fonction** déclarée ouverte,
le profil **élève** — depuis une vue parent, cocher enverrait un geste que l'enfant n'a pas
fait —, et une session qui n'est pas une **démonstration**, dont le moteur refuse d'écrire.
Un bouton qui échouerait à chaque clic ne s'affiche pas.

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
ED_DEMO=1 pnpm --filter @ecole2recte/web dev   # avec les deux espaces sur données inventées

pnpm probe       # sondage CORS, sans identifiants
pnpm verifier -- --config      # ce que le vérificateur voit, sans rien appeler
pnpm verifier -- --questions   # la question de sécurité, sur un vrai compte, à la main
pnpm har capture.har > forme.json   # la forme d'un endpoint, jamais ses valeurs
pnpm smoke       # les allers-retours d'écriture, sur un vrai compte, à la main
```

Copie `.env.example` en `.env`. En production, `SESSION_SECRET` est obligatoire : sans lui,
l'application refuse de sceller plutôt que de chiffrer avec une clé devinable.

### Comment c'est éprouvé

234 tests, sans réseau et sans compte — 197 pour le protocole, 37 pour l’application — sur
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
   section qui échoue n'emporte pas les autres. Un sceau modifié d'une lettre est refusé. La
   moyenne du bulletin l'emporte, sauf sur un retard démontré — et un écart inexpliqué ne
   suffit pas à la démonter.

La CI ajoute deux garde-fous qui ne sont pas des tests : aucune capture réseau versionnée,
et l'écriture fermée dans l'exemple de configuration — un fichier qui l'ouvrirait finirait
un jour copié tel quel en production.

## Déploiement (Cloudflare Workers)

`apps/web` tourne en Worker (`@sveltejs/adapter-cloudflare`) plutôt qu'en serveur Node : pas
de process à garder en vie, pas de machine à maintenir.

**La session ne peut pas rester en mémoire.** Un Worker n'est pas un process persistant —
chaque requête peut atterrir sur une isolate différente, n'importe où. La session vit donc
dans un Durable Object, un par session, hébergé par un second worker minuscule,
`apps/sessions/` : `apps/web` s'y adresse par un lien externe (`script_name` dans son
`wrangler.toml`), parce que l'adaptateur régénère son propre fichier de worker à chaque build
et ne peut donc pas exporter une classe à lui. En développement (`pnpm dev`), faute de ce
lien, la session retombe sur une simple `Map` en mémoire — voir `apps/web/src/lib/server/store.ts`.

```sh
# une fois, avant le premier déploiement
cd apps/sessions && npx wrangler deploy    # crée le Durable Object
cd ../web
npx wrangler secret put SESSION_SECRET     # openssl rand -base64 48

# à chaque déploiement
pnpm --filter @ecole2recte/web deploy
```

`apps/web/wrangler.toml` porte déjà la route vers `ed.moideici.tech` (le domaine doit être
sur Cloudflare) et les réglages non secrets de `.env.example` (`ED_API_VERSION`,
`ED_WRITE_POLICY`, …), modifiables sans reconstruire l'application.

Pour tester tout ça en local, sans compte Cloudflare :

```sh
cd apps/web
npx wrangler dev -c wrangler.toml -c ../sessions/wrangler.toml
```

## Éprouver sur un vrai compte

Deux mécanismes ne se tranchent pas hors ligne : la **réponse à la question de sécurité**
donnée d'avance — la question elle-même dépend de l'établissement, et un compte réel a rendu
« Quelle est votre classe ? » — et le **renouvellement du jeton**, dont le code exact rendu
par le service vient d'un relevé et non d'une observation.

`pnpm verifier -- --config` dit d'abord ce que le script voit, **sans rien appeler** : le
`.env` de la racine est lu (`id`, `mdp`, `reponse`, ou les noms `ED_*`), et ce mode n'affiche
jamais une valeur, seulement présent ou absent.

Il signale aussi que, lancé à travers `npx` puis `pnpm`, le script **n'hérite pas d'un
clavier utilisable**. On lui donne donc les faits en option, une fois pour toutes :

```sh
pnpm verifier -- --reponse "2011-02-28,1ERE G2"
```

**Et surtout pas en deux temps.** Relever la question puis répondre par son rang ne peut pas
marcher : ce sont deux connexions, donc deux questions tirées au hasard. L'essai qui l'a
montré avait vu « Quelle est votre année de naissance ? » puis, à la connexion suivante,
« Quel est votre jour de naissance ? » — le rang de l'année désignait un quantième, et le
service a répondu « identifiant ou mot de passe incorrect ».

Rien n'est écrit : la police d'écriture y reste sur `deny`, donc même une erreur de code ne
pourrait rien modifier. Les identifiants ne sont ni affichés ni conservés.

Le rapport final ne contient que des **formes** et des **codes**, jamais une valeur : une
proposition apparaît comme `99/99/9999` ou `9Aaa Aa9`. C'est tout ce qu'il faut pour corriger
une lecture qui ne reconnaîtrait pas l'écriture d'un établissement, et cela ne dit rien de la
personne — le rapport peut donc se recopier tel quel à qui aide. Les propositions elles-mêmes
ne s'affichent qu'à l'écran de qui lance le script.


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

## Licence

Code publié sous [licence MIT](LICENSE). Historique des versions : [CHANGELOG.md](CHANGELOG.md).
