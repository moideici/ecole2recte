# Changelog

Toutes les évolutions notables de ce projet. Les versions suivent [SemVer](https://semver.org/lang/fr/).

## [0.1.0] : première version publique

Instantané du dépôt au moment de son ouverture au public. Détail de l'historique ci-dessous, par mois.

### 2026-11
- Mise à jour du nom d'utilisateur GitHub : moidefr -> moideici

### 2026-10
- Refonte, lot 3 : Notes et Travail à faire à la manière de Pronote
- Refonte, lot 2 : accueil et emploi du temps plus proches de Pronote
- Refonte : thème bleu à la manière de Pronote, et un lapin pour mascotte
- Rester connecté tient enfin : durée de vie réelle, requêtes en file, session morte détectée

### 2026-09
- Rester connecté : le mot de passe scellé rouvre la session, sans jamais partir en rafale
- Le vérificateur garde le couple de confiance, au lieu de reposer la question chaque fois
- Le vérificateur dit ce qu'il coûte : une vraie connexion, et un compte qui peut se bloquer
- Le renouvellement du jeton se referme : le service l'a pris pour une activité suspecte
- Le service tire sa question au hasard : il faut répondre avec des faits, pas une réponse
- Le vérificateur se pilote sans clavier, parce qu'il n'y en a pas
- La question ne porte pas toujours sur une date : le champ devient une réponse
- Le vérificateur lit enfin le .env, et sait dire ce qu'il voit avant de se connecter
- Un vérificateur en lecture seule, pour ce qu'aucun test hors-ligne ne peut trancher
- La date de naissance répond à la question, et le jeton se renouvelle tout seul
- L'accueil devient une disposition : vingt-six tuiles, l'ordre et la quantité au choix
- Le travail à faire devient enfin lisible, et l'écriture s'ouvre sur quatre gestes
- La moyenne qui ne cache plus la dernière note, et l'allure d'un logiciel de vie scolaire
- Charte graphique proche de Pronote, et deux cartes d'accueil enfin cliquables
- Porte apps/web sur Cloudflare Workers, avec les sessions en Durable Object
- Espace professeur en lecture (P6), et un mode démonstration
- DEMARRER/ : ce qu'il faut installer, et quoi faire dans l'ordre
- Les tests : 137, sans réseau ni compte
- P3 à P5 — l'écriture documentée, les outils du réel, et un refus assumé
- P2 — l'application : un mandataire, onze pages, et le jeton qui ne descend jamais
- P1 — tout ce qu'ÉcoleDirecte sait dire, et ce que ça veut dire
- P0 — fondations du client web : le protocole, et rien d'autre
