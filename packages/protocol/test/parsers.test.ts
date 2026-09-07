import { describe, expect, it } from 'vitest'
import { parseTimetable } from '../src/parse/timetable.js'
import { parseDayContent, parseHomeworkSummary } from '../src/parse/homework.js'
import { parseGrades } from '../src/parse/grades.js'
import { parseSchoolLife } from '../src/parse/schoollife.js'
import { parseMessages } from '../src/parse/messages.js'
import { parseCloud, parseDocuments, parseNews, parseTextbooks } from '../src/parse/modules.js'
import { counterpart } from '../src/models.js'
import * as fixtures from './fixtures.js'

describe('emploi du temps', () => {
  const cours = parseTimetable(fixtures.TIMETABLE)

  it('remet la journée dans l’ordre', () => {
    expect(cours.map((entree) => entree.start)).toEqual([
      '2026-09-07T07:00:00',
      '2026-09-07T08:00:00',
      '2026-09-07T10:00:00',
      '2026-09-07T11:00:00',
    ])
  })

  it('garde le cours annulé au lieu de l’effacer', () => {
    // L'effacer ferait croire à un trou alors que la salle est réservée.
    expect(cours.find((entree) => entree.id === '103')?.canceled).toBe(true)
  })

  it('garde le groupe, qui distingue un dédoublement d’un doublon', () => {
    expect(cours.find((entree) => entree.id === '102')?.group).toBe('Groupe 2')
  })

  it('écarte une entrée sans horaire plutôt que d’inventer une heure', () => {
    expect(cours.some((entree) => entree.id === '104')).toBe(false)
  })
})

describe('cahier de textes', () => {
  it('lit le résumé par date et ignore les clés qui n’en sont pas', () => {
    const devoirs = parseHomeworkSummary(fixtures.HOMEWORK_SUMMARY)
    expect(devoirs).toHaveLength(3)
    expect(devoirs.map((devoir) => devoir.dueDate)).toEqual(['2026-09-08', '2026-09-08', '2026-09-10'])
  })

  it('signale un devoir à déposer en ligne', () => {
    const devoirs = parseHomeworkSummary(fixtures.HOMEWORK_SUMMARY)
    const enLigne = devoirs.find((devoir) => devoir.id === '5002')
    // Le taire serait pire : on cocherait une case en croyant avoir rendu.
    expect(enLigne?.onlineSubmission).toBe(true)
    expect(enLigne?.exam).toBe(true)
    expect(enLigne?.done).toBe(true)
  })

  it('n’a pas le contenu dans le résumé — il n’y est pas', () => {
    expect(parseHomeworkSummary(fixtures.HOMEWORK_SUMMARY).every((devoir) => devoir.content === '')).toBe(true)
  })

  it('décode le contenu du détail et le débarrasse du balisage', () => {
    const jour = parseDayContent(fixtures.DAY_CONTENT, '2026-09-08')
    expect(jour.homework[0]?.content).toBe('Exercices 12 à 15 page 42.\n\nApporter la calculatrice.')
    expect(jour.homework[0]?.attachments[0]?.name).toBe('fiche.pdf')
    expect(jour.homework[0]?.attachments[0]?.source).toBe('homework')
  })

  it('n’invente pas de séance vide', () => {
    const jour = parseDayContent(fixtures.DAY_CONTENT, '2026-09-08')
    expect(jour.sessions).toHaveLength(1)
    expect(jour.sessions[0]?.content).toBe('Chapitre 2 : les suites.')
  })
})

describe('notes', () => {
  const { periods, grades, subjectAverages } = parseGrades(fixtures.GRADES)

  it('lit les périodes et le conseil de classe', () => {
    expect(periods).toHaveLength(2)
    expect(periods[0]?.average).toBe(13.42)
    expect(periods[0]?.appreciation).toBe('Trimestre solide.')
    expect(periods[0]?.headTeacher).toBe('Mme Roux')
    // Une date française devient une date ISO.
    expect(periods[0]?.councilDate).toBe('2026-12-15')
  })

  it('lit une moyenne écrite avec une virgule', () => {
    expect(subjectAverages[0]?.average).toBe(14.5)
    expect(subjectAverages[0]?.minimum).toBe(4)
    expect(subjectAverages[0]?.teacher).toBe('M. Jean Petit')
  })

  it('recolle les appréciations de plusieurs professeurs', () => {
    expect(subjectAverages[0]?.appreciation).toBe('Bon trimestre.\n\nParticipation en hausse.')
  })

  it('laisse une note sans valeur sans valeur', () => {
    // « Abs » n'est pas un zéro.
    expect(grades.find((note) => note.id === '8002')?.value).toBeUndefined()
  })

  it('retient qu’une note ne compte pas', () => {
    expect(grades.find((note) => note.id === '8003')?.counted).toBe(false)
    expect(grades.find((note) => note.id === '8001')?.counted).toBe(true)
  })

  it('lit les compétences du socle', () => {
    expect(grades.find((note) => note.id === '8001')?.skills).toEqual([{ label: 'Calcul littéral', level: '3', value: 3 }])
  })
})

describe('vie scolaire', () => {
  const evenements = parseSchoolLife(fixtures.SCHOOL_LIFE)

  it('reconnaît les quatre natures', () => {
    expect(evenements.map((entree) => entree.kind).sort()).toEqual(['absence', 'encouragement', 'late'].sort())
  })

  it('garde la durée telle que l’établissement la compte', () => {
    // La recalculer donnerait un autre chiffre que celui montré aux parents.
    expect(evenements.find((entree) => entree.id === '3001')?.duration).toBe('Du 14/09 08:00 au 14/09 10:00')
  })

  it('classe du plus récent au plus ancien', () => {
    expect(evenements[0]?.id).toBe('3003')
  })
})

describe('messagerie', () => {
  it('lit les reçus, leur expéditeur recollé et leurs pièces jointes', () => {
    const { messages, classifiers, total } = parseMessages(fixtures.MESSAGES, 'received')
    expect(messages).toHaveLength(1)
    expect(messages[0]?.sender).toBe('Mme Claire Roux')
    expect(messages[0]?.read).toBe(false)
    expect(messages[0]?.body).toBe('Bonjour,\n\nLa réunion aura lieu le 3 octobre.')
    expect(messages[0]?.attachments[0]?.source).toBe('message')
    expect(classifiers[0]?.label).toBe('Administration')
    expect(total).toBe(137)
  })

  it('montre le destinataire dans les envoyés, pas « moi »', () => {
    const { messages } = parseMessages(fixtures.MESSAGES, 'sent')
    expect(messages[0]?.recipients).toEqual(['M. Jean Petit', 'Mme Claire Roux'])
    expect(counterpart(messages[0]!)).toBe('M. Jean Petit +1')
  })

  it('résume la première ligne sans balisage', () => {
    const { messages } = parseMessages(fixtures.MESSAGES, 'received')
    expect(messages[0]?.preview).toBe('Bonjour,')
  })
})

describe('modules optionnels', () => {
  it('range les documents par catégorie lisible', () => {
    const documents = parseDocuments(fixtures.DOCUMENTS)
    expect(documents.map((document) => document.category)).toEqual(['Bulletins', 'Administratif'])
    expect(documents[1]?.date).toBe('2026-09-01')
  })

  it('décode une actualité encodée et accepte celle qui ne l’est pas', () => {
    const actualites = parseNews(fixtures.NEWS)
    expect(actualites[0]?.content).toBe('Samedi 14 mars, de 9 h à 13 h.')
    expect(actualites.find((entree) => entree.id === '7002')?.content).toBe('Texte non encodé')
  })

  it('lit les manuels, avec ou sans lien', () => {
    const manuels = parseTextbooks(fixtures.TEXTBOOKS)
    expect(manuels).toHaveLength(2)
    expect(manuels[1]?.url).toBe('')
  })

  it('aplatit l’arborescence du stockage en gardant le chemin', () => {
    const fichiers = parseCloud(fixtures.CLOUD)
    expect(fichiers.map((fichier) => `${fichier.folder}/${fichier.name}`)).toEqual([
      'Documents/cours.pdf',
      'Documents / Archives/ancien.pdf',
      '/racine.txt',
    ])
    expect(fichiers[0]?.size).toBe(20480)
  })
})

describe('robustesse', () => {
  it('aucun lecteur ne lève sur une réponse absurde', () => {
    for (const parse of [
      parseTimetable,
      parseHomeworkSummary,
      parseGrades,
      parseSchoolLife,
      parseDocuments,
      parseNews,
      parseTextbooks,
      parseCloud,
    ]) {
      for (const entree of [null, undefined, 42, 'texte', [], {}, { data: null }]) {
        expect(() => parse(entree)).not.toThrow()
      }
    }
  })
})
