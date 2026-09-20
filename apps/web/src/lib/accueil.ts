import type { DataSection } from '@ecole2recte/protocol'

/**
 * Les widgets de la page d'accueil.
 *
 * Une seule liste décrit tout : ce qui existe, ce que ça pèse, et ce que l'établissement
 * doit avoir ouvert pour que ça ait un sens. Le serveur s'en sert pour ne charger **que** ce
 * que la disposition demande — un accueil de trois tuiles ne paie pas les vingt-trois autres.
 */
export type TailleWidget = 'S' | 'M' | 'L'

export interface Widget {
  id: string
  nom: string
  famille: string
  taille: TailleWidget
  /** Les sections de l'instantané à charger. Vide : le widget ne coûte aucun appel. */
  sections: DataSection[]
  /** Le widget a besoin du détail d'une journée — un appel de plus, et il le dit. */
  journee?: boolean
  /** Le module ÉcoleDirecte dont il dépend : fermé, le widget disparaît des choix. */
  module?: string
}

export const FAMILLES: Array<{ cle: string; nom: string; phrase: string }> = [
  { cle: 'journee', nom: 'La journée', phrase: 'Ce qu’on regarde le matin, et entre deux cours.' },
  { cle: 'travail', nom: 'Le travail', phrase: 'Ce qu’il y a à faire, et ce qui a été fait en classe.' },
  { cle: 'notes', nom: 'Les notes', phrase: 'Le bulletin, sa lecture et ses projections.' },
  { cle: 'vie', nom: 'La vie scolaire', phrase: 'Absences, retards, et ce que le conseil a écrit.' },
  { cle: 'etab', nom: 'L’établissement', phrase: 'Ce que l’école publie et met à disposition.' },
  { cle: 'reperes', nom: 'Les repères', phrase: 'Des points fixes, qui ne coûtent presque rien.' },
]

export const WIDGETS: Widget[] = [
  { id: 'maintenant', nom: 'En ce moment', famille: 'journee', taille: 'S', sections: ['timetable'], module: 'EDT' },
  { id: 'journee', nom: 'La journée', famille: 'journee', taille: 'M', sections: ['timetable'], module: 'EDT' },
  { id: 'salle', nom: 'Où aller', famille: 'journee', taille: 'S', sections: ['timetable'], module: 'EDT' },
  { id: 'semaine', nom: 'La semaine', famille: 'journee', taille: 'L', sections: ['timetable'], module: 'EDT' },
  { id: 'trous', nom: 'Heures libres', famille: 'journee', taille: 'S', sections: ['timetable'], module: 'EDT' },

  { id: 'a-faire', nom: 'Travail à faire', famille: 'travail', taille: 'M', sections: ['homework'], journee: true, module: 'CAHIER_DE_TEXTES' },
  { id: 'evaluations', nom: 'Évaluations annoncées', famille: 'travail', taille: 'M', sections: ['homework'], module: 'CAHIER_DE_TEXTES' },
  { id: 'avancement', nom: 'Devoirs faits', famille: 'travail', taille: 'S', sections: ['homework'], module: 'CAHIER_DE_TEXTES' },
  { id: 'contenu-seance', nom: 'Fait en cours', famille: 'travail', taille: 'M', sections: [], journee: true, module: 'CAHIER_DE_TEXTES' },

  { id: 'moyenne-generale', nom: 'Moyenne générale', famille: 'notes', taille: 'S', sections: ['grades'], module: 'NOTES' },
  { id: 'dernieres-notes', nom: 'Dernières notes', famille: 'notes', taille: 'M', sections: ['grades'], module: 'NOTES' },
  { id: 'moyennes-matieres', nom: 'Moyennes par matière', famille: 'notes', taille: 'L', sections: ['grades'], module: 'NOTES' },
  { id: 'progression', nom: 'Progression', famille: 'notes', taille: 'M', sections: ['grades'], module: 'NOTES' },
  { id: 'simulateur', nom: 'Simulateur', famille: 'notes', taille: 'M', sections: ['grades'], module: 'NOTES' },
  { id: 'appreciation', nom: 'Conseil de classe', famille: 'notes', taille: 'M', sections: ['grades'], module: 'NOTES' },

  { id: 'absences', nom: 'Absences et retards', famille: 'vie', taille: 'S', sections: ['schoolLife'], module: 'VIE_SCOLAIRE' },
  { id: 'encouragements', nom: 'Sanctions et encouragements', famille: 'vie', taille: 'S', sections: ['schoolLife'], module: 'VIE_SCOLAIRE' },

  { id: 'messages', nom: 'Messages non lus', famille: 'etab', taille: 'M', sections: ['messages'], module: 'MESSAGERIE' },
  { id: 'actualites', nom: 'Actualités', famille: 'etab', taille: 'M', sections: ['news'] },
  { id: 'documents', nom: 'Documents', famille: 'etab', taille: 'S', sections: ['documents'], module: 'DOCUMENTS_ELEVE' },
  { id: 'manuels', nom: 'Manuels numériques', famille: 'etab', taille: 'S', sections: ['textbooks'] },
  { id: 'stockage', nom: 'Fichiers récents', famille: 'etab', taille: 'S', sections: ['cloud'], module: 'CLOUD' },

  { id: 'profil', nom: 'Ma scolarité', famille: 'reperes', taille: 'S', sections: [] },
  { id: 'echeance', nom: 'Prochaine échéance', famille: 'reperes', taille: 'S', sections: ['grades'], module: 'NOTES' },
  { id: 'raccourcis', nom: 'Raccourcis', famille: 'reperes', taille: 'S', sections: [] },
]

const PAR_ID = new Map(WIDGETS.map((widget) => [widget.id, widget]))

export function widget(id: string): Widget | undefined {
  return PAR_ID.get(id)
}

/**
 * L'accueil de départ.
 *
 * La journée d'abord, puis où aller, puis ce qu'il y a à faire : l'ordre dans lequel on se
 * pose les questions le matin. Le reste vient après, et se change.
 */
export const DISPOSITION_PAR_DEFAUT = [
  'journee',
  'salle',
  'a-faire',
  'moyenne-generale',
  'dernieres-notes',
  'absences',
  'messages',
]

export const COOKIE_ACCUEIL = 'e2r_accueil'

/**
 * La disposition telle qu'elle est écrite dans le cookie.
 *
 * Un identifiant inconnu — widget retiré depuis, cookie bricolé — est ignoré sans bruit :
 * l'accueil de quelqu'un ne doit pas tomber parce qu'une tuile a changé de nom.
 */
export function lireDisposition(brut: string | null | undefined): string[] {
  if (!brut) return [...DISPOSITION_PAR_DEFAUT]
  const ids = brut
    .split('.')
    .map((entree) => entree.trim())
    .filter((entree) => PAR_ID.has(entree))
  // Une disposition vide est un choix : on n'y remet pas les widgets par défaut.
  return brut === '-' ? [] : ids.length > 0 ? [...new Set(ids)] : [...DISPOSITION_PAR_DEFAUT]
}

/** `-` marque l'accueil délibérément vide, qu'une chaîne vide ne saurait distinguer. */
export function ecrireDisposition(ids: string[]): string {
  const propres = ids.filter((id) => PAR_ID.has(id))
  return propres.length === 0 ? '-' : [...new Set(propres)].join('.')
}

/**
 * Ce qu'il faut charger pour cette disposition, et rien de plus.
 *
 * C'est tout l'intérêt de garder la disposition côté serveur : un accueil sans notes
 * n'appelle pas les notes. Un accueil vide n'appelle rien.
 */
export function sectionsPour(ids: string[]): DataSection[] {
  const voulues = new Set<DataSection>()
  for (const id of ids) {
    for (const section of PAR_ID.get(id)?.sections ?? []) voulues.add(section)
  }
  return [...voulues]
}

/** Vrai si l'un des widgets choisis réclame le détail d'une journée. */
export function exigeLaJournee(ids: string[]): boolean {
  return ids.some((id) => PAR_ID.get(id)?.journee === true)
}

/** Les widgets proposables : ceux dont le module est ouvert pour ce compte. */
export function widgetsDisponibles(modulesFermes: string[]): Widget[] {
  const fermes = new Set(modulesFermes.map((code) => code.toUpperCase()))
  return WIDGETS.filter((entree) => !entree.module || !fermes.has(entree.module))
}
