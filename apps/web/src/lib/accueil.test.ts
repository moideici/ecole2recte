import { describe, expect, it } from 'vitest'
import {
  DISPOSITION_PAR_DEFAUT,
  WIDGETS,
  ecrireDisposition,
  exigeLaJournee,
  lireDisposition,
  sectionsPour,
  widgetsDisponibles,
} from './accueil.js'

describe('catalogue des widgets', () => {
  it('n’a aucun identifiant en double', () => {
    // Deux tuiles de même identifiant : la disposition en perdrait une sans rien dire.
    const ids = WIDGETS.map((entree) => entree.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('n’a que des widgets connus dans la disposition par défaut', () => {
    const ids = new Set(WIDGETS.map((entree) => entree.id))
    expect(DISPOSITION_PAR_DEFAUT.every((id) => ids.has(id))).toBe(true)
  })

  it('ouvre sur la journée, puis la salle, puis le travail', () => {
    // L'ordre dans lequel on se pose les questions le matin.
    expect(DISPOSITION_PAR_DEFAUT.slice(0, 3)).toEqual(['journee', 'salle', 'a-faire'])
  })
})

describe('disposition', () => {
  it('rend celle par défaut quand le cookie est absent', () => {
    expect(lireDisposition(undefined)).toEqual(DISPOSITION_PAR_DEFAUT)
    expect(lireDisposition('')).toEqual(DISPOSITION_PAR_DEFAUT)
  })

  it('écarte un identifiant inconnu sans tomber', () => {
    // Un widget retiré depuis, un cookie bricolé : l'accueil ne doit pas s'écrouler.
    expect(lireDisposition('journee.inconnu.messages')).toEqual(['journee', 'messages'])
  })

  it('retient un accueil délibérément vide', () => {
    // Une chaîne vide ne distingue pas « rien choisi » de « tout retiré » : d'où le tiret.
    expect(ecrireDisposition([])).toBe('-')
    expect(lireDisposition('-')).toEqual([])
  })

  it('ne garde qu’une fois chaque tuile', () => {
    expect(ecrireDisposition(['journee', 'journee', 'salle'])).toBe('journee.salle')
    expect(lireDisposition('salle.salle.journee')).toEqual(['salle', 'journee'])
  })

  it('fait l’aller-retour sans rien perdre', () => {
    const choix = ['messages', 'journee', 'moyenne-generale']
    expect(lireDisposition(ecrireDisposition(choix))).toEqual(choix)
  })
})

describe('ce qu’une disposition coûte', () => {
  it('ne charge que les sections des tuiles choisies', () => {
    expect(sectionsPour(['moyenne-generale']).sort()).toEqual(['grades'])
    expect(sectionsPour(['journee', 'salle']).sort()).toEqual(['timetable'])
    expect(sectionsPour(['journee', 'messages', 'absences']).sort()).toEqual(['messages', 'schoolLife', 'timetable'])
  })

  it('ne charge rien du tout pour un accueil vide', () => {
    // C'est tout l'intérêt de garder la disposition côté serveur.
    expect(sectionsPour([])).toEqual([])
    expect(sectionsPour(['raccourcis', 'profil'])).toEqual([])
  })

  it('ne réclame le détail d’une journée que si une tuile en vit', () => {
    // Un appel de plus par journée : il ne part que s'il sert.
    expect(exigeLaJournee(['moyenne-generale', 'messages'])).toBe(false)
    expect(exigeLaJournee(['a-faire'])).toBe(true)
    expect(exigeLaJournee(['contenu-seance'])).toBe(true)
  })
})

describe('modules fermés', () => {
  it('ne propose pas une tuile dont le module est fermé', () => {
    // Un module fermé n'est pas une panne : la tuile disparaît des choix, sans message.
    const sansNotes = widgetsDisponibles(['NOTES']).map((entree) => entree.id)
    expect(sansNotes).not.toContain('moyenne-generale')
    expect(sansNotes).not.toContain('dernieres-notes')
    expect(sansNotes).toContain('journee')
  })

  it('garde les tuiles qui ne dépendent d’aucun module', () => {
    const rien = widgetsDisponibles(['EDT', 'NOTES', 'MESSAGERIE', 'CAHIER_DE_TEXTES', 'VIE_SCOLAIRE', 'CLOUD', 'DOCUMENTS_ELEVE'])
    expect(rien.map((entree) => entree.id)).toEqual(['actualites', 'manuels', 'profil', 'raccourcis'])
  })
})
