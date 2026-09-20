import { base64Encode } from '../src/encoding.js'

/**
 * Réponses de l'hôte enseignant, écrites à la main d'après la forme que lisent les clients
 * qui tournent en réel. Aucune ne vient d'un vrai compte : les noms sont inventés.
 */

export const TEACHER_LOGIN = {
  accounts: [
    {
      id: 5517,
      idLogin: 88001,
      typeCompte: 'P',
      prenom: 'Claire',
      nom: 'Martin',
      nomEtablissement: 'Lycée Victor Hugo',
      isProfEtPersonnel: false,
      modules: [
        { code: 'CAHIER_DE_TEXTES', enable: true },
        { code: 'CARNET_NOTES', enable: true },
        { code: 'MESSAGERIE', enable: true },
        { code: 'APPEL', enable: false },
      ],
      profile: {
        classes: [{ id: 812, code: '2GT3', libelle: 'Seconde 3' }],
        groupesNiveau: [{ id: 901, code: 'SPE-MATH', libelle: 'Spé maths 1re', idClasse: 0, codeMatiere: 'MATHS' }],
        matieres: [{ code: 'MATHS', libelle: 'Mathématiques' }],
      },
    },
  ],
}

const PERIODES = [
  {
    codePeriode: 'A001',
    libelle: 'Trimestre 1',
    libelleCourt: 'T1',
    etat: 'ouvert',
    dateDebut: '2026-09-01',
    dateFin: '2026-11-30',
    dateConseil: '2026-12-03',
    matieres: [{ code: 'MATHS', libelle: 'Mathématiques', avecNotation: true, isEditable: 'Si non vide' }],
  },
  // La même période une seconde fois, sans matières : elle ne doit ni doubler ni vider la première.
  { codePeriode: 'A001', libelle: 'Trimestre 1', matieres: [] },
  { codePeriode: 'A002', libelle: 'Trimestre 2', libelleCourt: 'T2', etat: 'cloture', matieres: [] },
]

export const CATALOG = {
  etablissements: [
    {
      id: 1,
      code: 'VH',
      nom: 'Lycée Victor Hugo',
      parametres: {
        grille: [
          { heureDbt: '09:00', heureFin: '09:55' },
          { heureDbt: '08:00', heureFin: '08:55' },
          { heureDbt: '08:00', heureFin: '08:55' },
        ],
      },
      niveaux: [
        {
          libelle: 'Seconde',
          classes: [
            // Rendue sans identifiant : elle se retrouve dans le profil du login, par son code.
            { idGroupe: 0, code: '2GT3', libelle: 'Seconde 3', typeEntity: 'C', isPP: false, tabPP: [{ idPP: 5517 }], periodes: PERIODES },
            { idGroupe: 815, code: '2GT6', libelle: 'Seconde 6', typeEntity: 'C', isPP: false, tabPP: [{ idPP: 42 }], periodes: [] },
          ],
          groupes: [],
        },
      ],
    },
  ],
  groupes: [
    { idGroupe: 901, etabId: 1, code: 'SPE-MATH', libelle: 'Spé maths 1re', typeEntity: 'G', periodes: PERIODES },
    // Sans établissement, un groupe à la racine n'est rattaché à rien.
    { idGroupe: 950, code: 'ORPHELIN', libelle: 'Groupe orphelin' },
  ],
  autresGroupes: [],
}

export const PUPILS = {
  eleves: [
    {
      id: 3001,
      prenom: 'Léa',
      nom: 'Bernard',
      sexe: 'F',
      classeLibelle: 'Seconde 3',
      dateNaissance: '2011-02-03',
      regime: 'Externe',
      photo: '//photo.jpg',
      dispositifs: [{ code: 'PAP', libelle: 'PAP' }],
      dispense: false,
      dateSortie: '',
    },
    { id: 3002, prenom: 'Adam', nom: 'Aubert', sexe: 'M', classe: { id: 812, libelle: 'Seconde 3' }, dispense: true },
    { prenom: 'Sans', nom: 'Identifiant' },
  ],
  entity: { id: 812, type: 'C', code: '2GT3', libelle: 'Seconde 3' },
  appelEnClasse: { effectue: false, dateHeure: '' },
}

export const LESSON_SLOTS = [
  {
    idCours: 44001,
    date: '2026-09-14',
    start_date: '2026-09-14 10:00',
    end_date: '2026-09-14 10:55',
    entityId: 812,
    entityCode: '2GT3',
    entityLibelle: 'Seconde 3',
    entityType: 'C',
    salle: 'B204',
    matiereCode: 'MATHS',
    matiereLibelle: 'Mathématiques',
    interrogation: '1',
    travailAFaire: true,
    aFaire: {
      idDevoir: 9,
      contenu: base64Encode('<p>Exercices 12 à 18</p><p>Page 45</p>'),
      donneLe: '2026-09-14',
      rendreEnLigne: false,
      ressourceDocuments: [{ fichierId: 11, leTypeDeFichier: 'FICHIER_CDT', libelle: 'Consigne.pdf' }],
    },
    seance: { idDevoir: 10, contenu: 'Test de fin de chapitre' },
  },
  {
    idCours: 44000,
    date: '2026-09-14',
    start_date: '2026-09-14 08:00',
    end_date: '2026-09-14 08:55',
    entityId: 901,
    entityCode: 'SPE-MATH',
    entityLibelle: 'Spé maths 1re',
    entityType: 'G',
    salle: 'C011',
    matiereCode: 'MATHS',
    matiereLibelle: 'Mathématiques',
    // Ici le contenu de séance n'est qu'un drapeau : il ne doit pas devenir une séance vide.
    contenuDeSeance: true,
    aFaire: { idDevoir: 0, contenu: '' },
  },
  { idCours: 44002, entityId: 812 },
]

export const GRADEBOOK = {
  devoirs: [
    {
      id: 71,
      libelle: 'DS 1',
      coef: 2,
      noteSur: 20,
      date: '2026-09-20',
      nonSignificatif: false,
      avecNote: true,
      idPeriode: 'A001X001',
      typeDevoir: { id: 1, code: 'DS', libelle: 'Devoir surveillé' },
      nomProf: 'Mme C. MARTIN',
    },
    { id: 72, libelle: 'QCM', coef: 1, noteSur: 10, date: '2026-09-15', nonSignificatif: false, typeDevoir: {} },
    { id: 73, libelle: 'Test blanc', coef: 1, noteSur: 20, date: '2026-09-25', nonSignificatif: true },
  ],
  eleves: [
    {
      eleve: { id: 3001, prenom: 'Léa', nom: 'Bernard', classeLibelle: 'Seconde 3', sexe: 'F' },
      devoirs: {
        '71': { idDevoir: 71, note: '15,5' },
        '72': { idDevoir: 72, note: '8' },
        // Une note qui ne rappelle pas son évaluation : sa clé la désigne.
        '73': { note: '2' },
      },
    },
    {
      eleve: { id: 3002, prenom: 'Adam', nom: 'Aubert', sexe: 'M' },
      devoirs: {
        '71': { idDevoir: 71, note: 'Abs' },
        '72': { idDevoir: 72, note: '5', commentaire: 'Rattrapage' },
      },
    },
  ],
}
