# Par où commencer

Ce dossier ne contient rien de compliqué : la liste de ce qu'il faut installer, et les
étapes **dans l'ordre**. Compte vingt minutes la première fois, dont l'essentiel en
téléchargements.

Tu n'as besoin d'aucune connaissance en développement pour aller jusqu'à l'étape 4.

---

## 0. Ce qu'il faut télécharger

Deux choses, et une seule est un vrai téléchargement.

| Quoi | Où | Vérifier que c'est bon |
|---|---|---|
| **Node.js 22 ou plus** (« LTS ») | https://nodejs.org | `node --version` doit afficher `v22.` ou plus |
| **Git** | https://git-scm.com/downloads | `git --version` doit afficher quelque chose |
| **pnpm** | *rien à télécharger* : `corepack enable pnpm` | `pnpm --version` doit afficher `10.` |

> **Sous Windows** : pendant l'installation de Node.js, laisse la case « Add to PATH »
> cochée. Ensuite, utilise **PowerShell** (pas l'invite de commandes) pour tout ce qui suit.
>
> **Sous macOS** : si `git` n'est pas là, la première commande `git` te proposera de
> l'installer. Accepte.

Rien d'autre. Pas de base de données, pas de Docker, pas de compte à créer.

---

## 1. Récupérer le code

Ouvre un terminal (PowerShell sous Windows, Terminal sous macOS/Linux) et colle :

```sh
git clone https://github.com/moidefr/ecole2recte
cd ecole2recte
git checkout claude/ecole2rect-app-refactor-x70q66
```

---

## 2. Tout installer et vérifier

**macOS ou Linux :**

```sh
bash DEMARRER/demarrer.sh
```

**Windows (PowerShell) :**

```powershell
powershell -ExecutionPolicy Bypass -File DEMARRER\demarrer.ps1
```

Ce script installe les dépendances, lance les 137 tests, construit l'application, et crée
ton fichier `.env` avec une clé de sécurité générée au hasard. Il ne touche à rien d'autre
sur ta machine et ne se connecte à aucun compte.

Si tu vois `Tout est prêt.` à la fin, l'étape est passée.

---

## 3. Trancher la question CORS — 2 minutes, et c'est important

C'est la seule question technique qui reste ouverte, et elle se règle en deux minutes.
Elle décide si l'application **doit** obligatoirement passer par un serveur, ou si elle
pourrait un jour tourner seule dans un navigateur.

```sh
pnpm probe
```

Ça affiche un verdict. **Copie-colle-moi ce qu'il affiche.**

Puis, pour la vraie vérification — un navigateur est le seul juge valable ici :

```sh
pnpm dlx serve tools/probe
```

Ouvre l'adresse indiquée, clique sur « Lancer le sondage », et **dis-moi ce qui s'affiche**.
Les deux réponses possibles sont utiles ; il n'y a pas de mauvais résultat.

> Aucun identifiant n'est utilisé à cette étape. Le sondage interroge une page publique.

---

## 4. Lancer l'application et te connecter

```sh
pnpm --filter @ecole2recte/web dev
```

Ouvre http://localhost:5173 et connecte-toi avec tes identifiants ÉcoleDirecte habituels.

Si ÉcoleDirecte pose une question de sécurité, elle s'affiche avec **ses propres
propositions** : c'est toi qui choisis. L'application ne devine jamais la réponse. Une fois
répondue, elle ne sera plus reposée à chaque connexion.

**Ce que tu devrais voir** : l'accueil, l'emploi du temps, les devoirs, les notes avec le
simulateur, la messagerie, la vie scolaire, les documents. Tout en lecture.

**Dis-moi ce qui ne marche pas.** C'est l'étape la plus utile de toutes : le code n'a jamais
vu un vrai compte, et chaque établissement rend ses données un peu différemment. Une capture
d'écran d'un écran vide ou bizarre vaut mieux qu'un long message.

Pour arrêter : `Ctrl+C` dans le terminal.

---

## 5. Ouvrir l'écriture — quand tu voudras

Pour l'instant l'application **ne modifie rien** sur ÉcoleDirecte : cocher un devoir est
écrit mais désactivé. C'est délibéré — une écriture jamais éprouvée peut faire des dégâts
qu'on ne rattrape pas.

Pour l'éprouver pour de vrai :

```sh
pnpm smoke
```

Le script te demande tes identifiants **au clavier** (ils ne sont écrits nulle part, ni sur
disque ni dans le terminal), puis fait des allers-retours **réversibles** : il coche un
devoir, vérifie que le serveur a bien suivi, puis le décoche. Il crée un dossier de test
dans ton espace de stockage, vérifie qu'il apparaît, puis le supprime.

Si tout affiche `ok`, dis-le-moi : j'ouvre les fonctions correspondantes dans l'application.

> Ce script ne fait **rien d'irréversible**. Il n'envoie aucun message à personne.

---

## 6. Débloquer l'envoi de messages — seulement si tu veux

L'envoi de message n'existe dans aucune documentation publique. Pour l'écrire sans deviner,
j'ai besoin de voir **la forme** de la requête que le vrai site envoie.

1. Va sur www.ecoledirecte.com dans Chrome ou Firefox, connecte-toi.
2. Appuie sur `F12`, onglet **Réseau**, coche **Conserver le journal**.
3. Envoie **un** message (à toi-même, c'est parfait).
4. Clic droit dans la liste → **Enregistrer tout dans un fichier HAR**.
5. Dans le terminal :

```sh
pnpm har le-fichier.har > forme.json
```

6. **Envoie-moi `forme.json`** — pas le fichier `.har`.

> **Important** : le fichier `.har` contient ton **mot de passe en clair** et ton jeton de
> session. Il ne doit jamais être partagé, ni mis dans le dépôt (git le refuse déjà).
> `forme.json`, lui, ne contient que les *noms* des champs — jamais leurs valeurs.

---

## À ne jamais faire

- Ne mets jamais un fichier `.har` ou ton `.env` dans le dépôt. Les deux sont déjà refusés
  par git et par la CI, mais mieux vaut le savoir.
- Ne mets pas tes identifiants dans un fichier. `pnpm smoke` te les demande au clavier.
- N'ouvre pas `ED_WRITE_FEATURES` toi-même avant que l'étape 5 soit passée au vert.

## Si ça casse

| Message | Quoi faire |
|---|---|
| `pnpm : commande introuvable` | `corepack enable pnpm`, puis rouvre le terminal |
| `node : commande introuvable` | Node n'est pas installé, ou le terminal n'a pas été rouvert après l'installation |
| `EACCES` / permission refusée | Ne lance pas en administrateur ; place le dossier dans tes documents personnels |
| Le port 5173 est occupé | `pnpm --filter @ecole2recte/web dev -- --port 5174` |
| Autre chose | Copie-colle-moi le message d'erreur en entier |
