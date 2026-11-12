# Feuille de route

Ce fichier est la liste de travail du dépôt : ce qui est fait, ce qui manque, et **pourquoi**
ce qui manque manque. Une case cochée veut dire « écrit et couvert par ce qu'on peut vérifier
sans compte réel », pas « éprouvé sur le terrain ».

## P0 — Fondations · fait

- [x] Monorepo, protocole sans dépendance, testable sans réseau ni compte.
- [x] Connexion complète : jeton GTK, `login.awp`, jetons repris au vol, `renewtoken.awp`.
- [x] Connexion alignée sur les clients qui se connectent en septembre 2026 : GTK neuf avant
      chaque login, jetons de la question emportés par le login qui la conclut, `cn`/`cv` à la
      racine et dans `fa`, version `4.101.4`, code 526, et un couple de confiance périmé oublié
      au lieu de bloquer la connexion.
- [x] Question de sécurité : question et propositions décodées, choix renvoyé, couple
      `cn`/`cv` conservé. Jamais devinée, jamais approchée, une seule tentative.
- [x] Date de naissance et classe, facultatives à la connexion : elles répondent à la
      question de sécurité en renvoyant la proposition du serveur telle quelle. Zéro ou
      plusieurs correspondances : la question se pose. **Relevé sur un compte réel** : le
      service tire sa question au hasard à chaque connexion — année, jour, mois, date
      entière, classe — d'où deux faits et une lecture de la question pour savoir quelle
      part est demandée.
- [x] **Renouvellement automatique du jeton** : une lecture refusée pour jeton expiré est
      renouvelée et rejouée une fois. Une écriture ne l'est jamais — un commentaire envoyé
      deux fois ne se reprend pas.
- [x] Codes métier, dont le **517** (version périmée) que le client Android ne connaît pas.
- [x] Point de passage unique de l'écriture, fermé par défaut.
- [ ] **Trancher la question CORS.** Le mandataire réseau de l'environnement de
      développement refuse `api.ecoledirecte.com`. `pnpm probe` la sonde sans identifiants,
      et `tools/probe/cors.html` la tranche depuis un vrai navigateur — seul juge valable,
      puisque `curl` n'applique pas la politique d'origine. L'architecture ne dépend pas de
      la réponse : elle suppose le mandataire nécessaire.

## P1 — Lecture · fait

- [x] Modèle complet et dix lecteurs défensifs (emploi du temps, cahier de textes et contenu
      de séance, notes avec périodes et compétences, vie scolaire, messagerie et ses trois
      dossiers, documents, actualités, manuels, espace de stockage).
- [x] Chargement par section, chacune échouant seule.
- [x] Dates de calendrier en chaînes ISO, calculées en UTC.
- [x] Moyennes, simulateur, note à viser, recherche insensible aux accents.
- [x] Moyenne du bulletin **confrontée aux notes** : quand elle est manifestement celle d'avant
      des notes déjà saisies, l'application affiche la sienne et dit laquelle manquait. Un écart
      inexpliqué, lui, laisse le bulletin avoir raison.

## P2 — Application · fait

- [x] Mandataire : le jeton ne descend jamais jusqu'au navigateur.
- [x] Connexion, question de sécurité, déconnexion.
- [x] Onze pages, barre latérale sur ordinateur et barre basse sur téléphone.
- [x] Les habitudes d'un logiciel de vie scolaire : bandeau de marque, sections à icônes,
      emploi du temps en grille hebdomadaire, relevé de notes dépliable par matière.
- [x] **La fiche d'une journée** (`/devoirs/{date}`) : énoncés, pièces jointes, contenu de
      séance et cours du jour. Le détail d'un jour était lu par le protocole et affiché nulle
      part ; un devoir, un cours de la grille et une ligne du fil y mènent maintenant.
- [x] Barre de progression, bouton « Actualiser », thème appliqué avant le premier pixel et
      réglable depuis le bandeau.
- [x] **Accueil en widgets** : vingt-six tuiles, l'ordre et la quantité au choix, gardés dans
      un cookie pour que le serveur ne charge que les sections utiles. Réglable sans
      JavaScript, en colonnes qui se remplissent sur écran large.
- [x] Compte parent : un profil par enfant, sélecteur, messagerie de la famille.
- [x] Compte enseignant **reconnu et annoncé comme non pris en charge** — voir P5.
- [x] Téléchargement des pièces jointes par le serveur.
- [x] Thème clair/sombre/système, PWA.

- [x] Cinq thèmes de couleurs, apparence claire/sombre/système et test des contrastes AA.
- [x] Quatre tailles de texte persistées avant affichage, avec aperçu dans Réglages et en démo.
- [x] Cartes harmonisées par jetons, focus visible, cibles mobiles et mouvements réduits.


- [x] Notes : courbes cumulées par matière et générale en SVG, avec résumé accessible.
- [x] Notes : moyenne de classe et extrêmes disponibles, écart par devoir sur son barème.
- [x] Notes : pastille « Nouveau » pendant trois jours depuis la saisie, sinon le devoir.
- [x] Notes : étiquettes officielle/calculée et explication du retard possible du bulletin.

## P3 — Écriture documentée

- [x] Cocher et décocher un devoir (`PUT cahierdetexte.awp`).
- [x] Commenter un devoir (`POST afaire/commentaires.awp`).
- [x] Espace de stockage : créer, renommer, supprimer.
- [x] `tools/smoke` : les allers-retours réels, à lancer à la main, jamais en CI.
- [x] `tools/verifier` : la vérification en **lecture seule** sur un vrai compte (date de
      naissance, renouvellement du jeton, chaîne complète), avec un rapport sans valeur
      personnelle. À lancer à la main, jamais en CI.
- [x] Interfaces des quatre écritures ouvertes : case à cocher, commentaire de devoir,
      création de dossier, renommage de fichier.
- [ ] **Éprouver ces fonctions sur un vrai compte.** Elles sont ouvertes en production
      (`homework-done`, `homework-comment`, `cloud-folder`, `cloud-rename`) à la demande du
      propriétaire du dépôt, **avant** leur aller-retour réel : c'est sa décision, et elle
      inverse la règle du projet. `pnpm smoke` reste à passer, et `cloud-delete` reste fermée.
- [ ] Téléversement de fichier (`televersement.awp`, `multipart/form-data`).

## P4 — Écriture non documentée

Rien de ce qui suit n'est documenté publiquement. La forme exacte des requêtes doit être
observée sur le vrai site, avec son propre compte, via `tools/har/extract.mjs` — qui n'extrait
que les **noms** de champs, jamais les valeurs, et refuse d'écrire s'il voit passer un jeton.

- [ ] **Envoi d'un message**, et recherche de destinataires. Le test s'adressera au compte
      lui-même, et le corps relu depuis « envoyés » sera comparé caractère par caractère :
      c'est ce qui prouve qu'un accent, un retour à la ligne ou un message long ne sont pas
      mutilés. Un professeur n'est pas une cible de test.
- [ ] **Justification d'une absence.** Le service dit si elle est justifiable en ligne
      (`justifieEd`) mais aucune source ne documente l'envoi.
- [ ] **Rendu de devoir en ligne.** Le modèle sait déjà signaler qu'un devoir l'attend ; le
      lien entre un fichier téléversé et le devoir n'est documenté nulle part. Irréversible :
      il ne sera pas écrit à l'aveugle.
- [ ] Archivage et suppression d'un message.

## P5 — Professeur · lecture écrite

La lecture est écrite et couverte par des réponses reconstituées d'après les clients qui lisent
ces routes en réel (`jeromeboivin/EcoleDirecteMCP`, relevé du trafic du site, septembre 2026).
**Rien n'a encore été vérifié sur un compte enseignant de ce projet.**

- [x] Compte `typeCompte: "P"` reconnu — plusieurs clients indépendants le lisent ainsi — avec
      ses classes, groupes (`groupesNiveau`) et matières du login.
- [x] Hôte `apip.ecoledirecte.com` : emploi du temps, catalogue `niveauxListe.awp`, élèves d'une
      classe, cahier de textes `loadslots`, grille de notes, messagerie enseignant.
- [x] Espace `/prof` : accueil, emploi du temps, classes, élèves, cahier de textes, notes et
      messagerie. Les moyennes sont calculées à partir de la grille et annoncées comme telles.
- [x] Démonstration sur données inventées (`ED_DEMO=1`), élève **et** professeur, sans aucune
      requête vers ÉcoleDirecte.
- [ ] **Premier aller-retour réel**, avec un professeur volontaire qui se connecte lui-même :
      connexion, catalogue, une grille de notes. Les formes relevées sur son compte par
      `tools/har/extract.mjs` remplacent alors les fixtures.
- [ ] Élèves d'un **groupe** : la route n'est vue qu'avec un créneau d'appel dans le corps.
- [ ] Photos des élèves : leur téléchargement n'est documenté nulle part.
- [ ] Pièces jointes de la messagerie et du cahier de textes côté enseignant.
- [ ] Appréciations, conseil de classe, carnet de correspondance : routes connues en lecture.
- [ ] Compte à double rôle professeur et personnel (`isProfEtPersonnel`, bascule `renewtoken.awp`).
- [ ] Écriture : saisie de notes, appel, cahier de textes. **Aucune documentation publique
      fiable**, et chacune touche le dossier scolaire d'élèves : hors de portée tant qu'elle n'a
      pas été observée et éprouvée avec un professeur, et avec l'accord de l'établissement.

## P6 — Qualité et exploitation

- [ ] Serveur factice rejouant les fixtures, y compris les codes d'erreur.
- [ ] Instantanés de requête : les octets envoyés, figés, pour chaque écriture.
- [ ] Bout en bout en 390 px et 1440 px.
- [ ] Magasin de sessions partagé (Redis) : l'actuel est en mémoire, donc à une seule
      instance et perdu au redémarrage.
- [ ] Limitation de débit côté client. Aucune n'est documentée côté service : la prudence
      remplace le savoir.

## Ce qui restera à faire avec un compte réel

Ces points ne sont pas des oublis : ils sont invérifiables ici, et le dire vaut mieux que de
les cocher.

- Les variantes de réponses selon l'établissement. Les lecteurs acceptent plusieurs
  orthographes, aucune n'a été confrontée à un vrai compte.
- La question de sécurité sur un compte qui pose autre chose qu'une date de naissance.
- La forme exacte des trois modules optionnels, dont les clés sont « décrites par la
  communauté ».
- La durée de vie réelle du jeton, et la règle qui décide qu'ÉcoleDirecte repose la question
  de sécurité. Aucune source ne les donne.
