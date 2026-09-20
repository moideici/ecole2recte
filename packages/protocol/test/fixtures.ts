/**
 * Des réponses telles qu'ÉcoleDirecte les rend.
 *
 * Écrites à la main d'après la forme documentée, avec **les variantes** que les lecteurs
 * doivent absorber : une classe tantôt objet tantôt libellé, un nombre écrit « 12,5 », une
 * date en jj/mm/aaaa, un contenu encodé en base64. Une fixture trop propre ne prouve rien.
 */

function b64(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64')
}

export const TIMETABLE = [
  {
    id: 101,
    text: 'MATHS',
    matiere: 'Mathématiques',
    prof: 'M. Petit',
    salle: 'C011',
    start_date: '2026-09-07 08:00',
    end_date: '2026-09-07 09:00',
    isAnnule: false,
    typeCours: 'COURS',
  },
  {
    id: 102,
    matiere: 'Anglais',
    prof: 'Mme Roux',
    salle: 'B204',
    start_date: '2026-09-07 10:00',
    end_date: '2026-09-07 11:00',
    isAnnule: false,
    libelleGroupe: 'Groupe 2',
  },
  {
    id: 103,
    matiere: 'Histoire',
    prof: 'M. Blanc',
    salle: 'A101',
    start_date: '2026-09-07 11:00',
    end_date: '2026-09-07 12:00',
    // Un cours annulé reste dans la réponse : l'effacer ferait croire à un trou.
    isAnnule: true,
  },
  // Volontairement en désordre : le service ne garantit pas l'ordre.
  {
    id: 100,
    matiere: 'Français',
    prof: 'Mme Noir',
    salle: 'D002',
    start_date: '2026-09-07 07:00',
    end_date: '2026-09-07 08:00',
  },
  { id: 104, matiere: 'Sans horaire' },
]

export const HOMEWORK_SUMMARY = {
  '2026-09-08': [
    { idDevoir: 5001, matiere: 'Mathématiques', interrogation: false, aFaire: { effectue: false, donneLe: '2026-09-01' } },
    { idDevoir: 5002, matiere: 'Anglais', interrogation: true, aFaire: { effectue: true, rendreEnLigne: true } },
  ],
  '2026-09-10': [{ idDevoir: 5003, matiere: 'Histoire', aFaire: { effectue: false } }],
  codeMatiere: 'clé qui n’est pas une date',
}

export const DAY_CONTENT = {
  matieres: [
    {
      id: 900,
      matiere: 'Mathématiques',
      nomProf: 'M. Petit',
      interrogation: false,
      aFaire: {
        idDevoir: 5001,
        contenu: b64('<p>Exercices 12 à 15 page 42.</p><br/>Apporter la calculatrice.'),
        effectue: false,
        rendreEnLigne: false,
        documents: [{ id: 77, libelle: 'fiche.pdf', type: 'FICHIER_CDT' }],
      },
      contenuDeSeance: { contenu: b64('<p>Chapitre 2 : les suites.</p>'), documents: [] },
    },
    // Une séance sans contenu ni document n'apprend rien : elle ne doit pas produire de carte.
    { id: 901, matiere: 'Anglais', contenuDeSeance: { contenu: '', documents: [] } },
  ],
}

export const GRADES = {
  periodes: [
    {
      idPeriode: 'A001',
      periode: 'Trimestre 1',
      cloture: false,
      isCurrent: true,
      dateDebut: '2026-09-01',
      dateFin: '2026-12-15',
      moyenneGenerale: '13,42',
      moyenneClasse: '12,10',
      ensembleMatieres: {
        nomPP: 'Mme Roux',
        dateConseil: '15/12/2026',
        heureConseil: '17:30',
        appreciationPP: 'Trimestre solide.',
        disciplines: [
          {
            codeMatiere: 'MATH',
            discipline: 'Mathématiques',
            moyenne: '14,50',
            moyenneClasse: '11,80',
            moyenneMin: '4,00',
            moyenneMax: '18,50',
            coef: 4,
            professeurs: [{ nom: 'Petit', prenom: 'Jean', civilite: 'M.' }],
            appreciations: [{ appreciation: 'Bon trimestre.' }, { appreciation: 'Participation en hausse.' }],
          },
          { codeMatiere: 'ANG', discipline: 'Anglais', moyenne: '11', coef: 2, professeurs: [] },
        ],
      },
    },
    { idPeriode: 'A002', periode: 'Trimestre 2', cloture: true, ensembleMatieres: { disciplines: [] } },
  ],
  notes: [
    {
      id: 8001,
      devoir: 'Contrôle 1',
      codePeriode: 'A001',
      libelleMatiere: 'Mathématiques',
      valeur: '15,5',
      noteSur: '20',
      coef: '2',
      moyenneClasse: '11,2',
      minClasse: '3',
      maxClasse: '19',
      date: '2026-09-20',
      typeDevoir: 'Contrôle',
      nonSignificatif: false,
      elementsProgramme: [{ libelleCompetence: 'Calcul littéral', valeur: 3 }],
    },
    {
      id: 8002,
      devoir: 'Interro surprise',
      codePeriode: 'A001',
      libelleMatiere: 'Mathématiques',
      // Sans valeur : « Abs ». La lire comme zéro serait une accusation.
      valeur: 'Abs',
      noteSur: '20',
      coef: '1',
      date: '2026-09-25',
    },
    {
      id: 8003,
      devoir: 'Devoir maison',
      codePeriode: 'A001',
      libelleMatiere: 'Anglais',
      valeur: '18',
      noteSur: '20',
      coef: '1',
      // Ne compte pas : l'inclure fausserait la moyenne.
      nonSignificatif: true,
      date: '2026-09-22',
    },
  ],
}

export const SCHOOL_LIFE = {
  absencesRetards: [
    {
      id: 3001,
      typeElement: 'Absence',
      date: '2026-09-14 08:00',
      displayDate: 'Du 14/09 08:00 au 14/09 10:00',
      justifie: false,
      motif: 'Non renseigné',
      libelle: 'Absence',
    },
    { id: 3002, typeElement: 'Retard', date: '2026-09-16 09:05', justifie: true, motif: 'Transport' },
  ],
  sanctionsEncouragements: [
    { id: 3003, typeElement: 'Encouragement', date: '2026-09-20', libelle: 'Encouragements du conseil' },
  ],
}

export const MESSAGES = {
  classeurs: [{ id: 12, libelle: 'Administration' }],
  pagination: { total: 137 },
  messages: {
    received: [
      {
        id: 6001,
        subject: 'Réunion parents-professeurs',
        read: false,
        date: '2026-09-18 14:02',
        from: { civilite: 'Mme', prenom: 'Claire', nom: 'Roux', particule: '' },
        to: [],
        content: b64('<p>Bonjour,</p><p>La réunion aura lieu le 3 octobre.</p>'),
        files: [{ id: 88, libelle: 'convocation.pdf', type: 'PIECE_JOINTE' }],
      },
    ],
    sent: [
      {
        id: 6002,
        subject: 'Absence de demain',
        read: true,
        date: '2026-09-19 08:30',
        from: { prenom: 'Camille', nom: 'Durand' },
        to: [
          { civilite: 'M.', prenom: 'Jean', nom: 'Petit' },
          { civilite: 'Mme', prenom: 'Claire', nom: 'Roux' },
        ],
        content: b64('Bonjour, Camille sera absente demain matin.'),
      },
    ],
  },
}

export const DOCUMENTS = {
  notes: [{ id: 4001, libelle: 'Bulletin T1.pdf', date: '2026-12-20', type: 'BULLETIN' }],
  administratifs: [{ id: 4002, libelle: 'Certificat.pdf', date: '01/09/2026', type: 'ADMIN' }],
}

export const NEWS = {
  actualites: [
    {
      id: 7001,
      titre: 'Portes ouvertes',
      contenu: b64('<p>Samedi 14 mars, de 9 h à 13 h.</p>'),
      date: '2026-10-01',
      auteur: 'La direction',
      documents: [{ id: 99, libelle: 'affiche.pdf', type: 'PIECE_JOINTE' }],
    },
    { id: 7002, titre: 'Cantine', contenu: 'Texte non encodé', date: '2026-09-30' },
  ],
}

export const TEXTBOOKS = {
  manuels: [
    { id: 'm1', titre: 'Maths 1re', matiere: 'Mathématiques', editeur: 'Hachette', url: 'https://exemple.test/m1' },
    { id: 'm2', titre: 'Anglais 1re', matiere: 'Anglais', editeur: 'Nathan' },
  ],
}

export const CLOUD = {
  ressources: [
    {
      id: 'd1',
      libelle: 'Documents',
      typeRessource: 'folder',
      children: [
        { id: 'f1', libelle: 'cours.pdf', taille: 20480, date: '2026-09-05' },
        {
          id: 'd2',
          libelle: 'Archives',
          typeRessource: 'folder',
          children: [{ id: 'f2', libelle: 'ancien.pdf', taille: 1024 }],
        },
      ],
    },
    { id: 'f3', libelle: 'racine.txt', taille: 12 },
  ],
}
