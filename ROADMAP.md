# Feuille de route

Ce fichier est la liste de travail du dépôt : ce qui est fait, ce qui manque, et **pourquoi**
ce qui manque manque. Une case cochée veut dire « écrit et couvert par ce qu'on peut vérifier
sans compte réel », pas « éprouvé sur le terrain ».

## P0 — Fondations · fait

- [x] Monorepo, protocole sans dépendance, testable sans réseau ni compte.
- [x] Connexion complète : jeton GTK, `login.awp`, jetons repris au vol, `renewtoken.awp`.
- [x] Question de sécurité : question et propositions décodées, choix renvoyé, couple
      `cn`/`cv` conservé. Jamais devinée, jamais approchée, une seule tentative.
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

## P2 — Application · fait

- [x] Mandataire : le jeton ne descend jamais jusqu'au navigateur.
- [x] Connexion, question de sécurité, déconnexion.
- [x] Onze pages, barre latérale sur ordinateur et barre basse sur téléphone.
- [x] Compte parent : un profil par enfant, sélecteur, messagerie de la famille.
- [x] Compte enseignant **reconnu et annoncé comme non pris en charge** — voir P5.
- [x] Téléchargement des pièces jointes par le serveur.
- [x] Thème clair/sombre/système, PWA.

## P3 — Écriture documentée

- [x] Cocher et décocher un devoir (`PUT cahierdetexte.awp`).
- [x] Commenter un devoir (`POST afaire/commentaires.awp`).
- [x] Espace de stockage : créer, renommer, supprimer.
- [x] `tools/smoke` : les allers-retours réels, à lancer à la main, jamais en CI.
- [ ] **Ouvrir ces fonctions.** Aucune ne passe en `allow` avant que son aller-retour ne soit
      vert sur un vrai compte. C'est la seule étape qui ne peut pas être faite ici.
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

## P5 — Professeur

Conditionné à un compte enseignant. En attendant, la place est réservée et rien n'est deviné.

- [x] Second hôte `apip.ecoledirecte.com` prêt dans le client.
- [x] Rôle reconnu, et page qui explique l'absence de support au lieu d'enchaîner des
      « accès refusé ».
- [ ] Lecture : emploi du temps, classes et groupes, messagerie enseignant, cahier de textes.
      Documenté par **une seule** source de 2025, non corroborée, et la valeur exacte de
      `typeCompte` pour un enseignant n'est même pas confirmée.
- [ ] Écriture : saisie de notes, appel, cahier de textes. **Aucune documentation publique.**

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
