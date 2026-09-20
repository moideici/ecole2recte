import type { CloudFile, Document, NewsItem, Textbook } from '../models.js'
import { attachmentsOf } from './attachments.js'
import { base64DecodeOrRaw } from '../encoding.js'
import { type Json, asObject, objects, pickDate, pickNumber, pickText, plainText, text } from './json.js'

/**
 * Les modules qu'un établissement peut ne pas ouvrir.
 *
 * Documents, actualités, manuels numériques et espace de stockage. Leurs clés sont
 * « décrites par la communauté » plus qu'elles ne sont documentées : chaque lecteur accepte
 * donc plusieurs orthographes, et un module fermé se traduit par une liste vide, pas par une
 * erreur répétée à chaque synchronisation.
 */
export function parseDocuments(data: unknown): Document[] {
  const root = asObject(data)
  if (!root) return []
  const documents: Document[] = []
  for (const [category, value] of Object.entries(root)) {
    for (const raw of objects(value)) {
      const id = pickText(raw, 'id')
      if (id === '') continue
      const document: Document = {
        id,
        name: pickText(raw, 'libelle', 'nom') || 'Document',
        category: labelForCategory(category),
        type: pickText(raw, 'type') || category,
      }
      const date = pickDate(raw, 'date', 'dateDepot')
      if (date) document.date = date
      documents.push(document)
    }
  }
  return documents
}

const CATEGORIES: Record<string, string> = {
  notes: 'Bulletins',
  viesScolaire: 'Vie scolaire',
  vieScolaire: 'Vie scolaire',
  administratifs: 'Administratif',
  factures: 'Factures',
}

function labelForCategory(key: string): string {
  return CATEGORIES[key] ?? key
}

export function parseNews(data: unknown): NewsItem[] {
  const root = asObject(data)
  const list = root ? (root['actualites'] ?? root['articles'] ?? root['news']) : data
  const news: NewsItem[] = []
  for (const raw of objects(list)) {
    const id = pickText(raw, 'id')
    const title = pickText(raw, 'titre', 'title', 'libelle')
    if (id === '' && title === '') continue
    const item: NewsItem = {
      id: id || title,
      title: title || 'Actualité',
      content: contentOf(raw),
      author: pickText(raw, 'auteur', 'author'),
      category: pickText(raw, 'categorie', 'category'),
      attachments: attachmentsOf(raw, 'resource'),
    }
    const date = pickDate(raw, 'date', 'datePublication')
    if (date) item.date = date
    news.push(item)
  }
  return news.sort((left, right) => (right.date ?? '').localeCompare(left.date ?? ''))
}

function contentOf(raw: Json): string {
  const value = text(raw['contenu'] ?? raw['content'] ?? raw['texte'])
  if (value === '') return ''
  return plainText(base64DecodeOrRaw(value))
}

export function parseTextbooks(data: unknown): Textbook[] {
  const root = asObject(data)
  const list = root ? (root['manuels'] ?? root['manuelsNumeriques'] ?? root['data']) : data
  const textbooks: Textbook[] = []
  for (const raw of objects(list)) {
    const title = pickText(raw, 'titre', 'libelle', 'nom')
    if (title === '') continue
    textbooks.push({
      id: pickText(raw, 'id') || title,
      title,
      subject: pickText(raw, 'matiere', 'discipline'),
      publisher: pickText(raw, 'editeur', 'publisher'),
      url: pickText(raw, 'url', 'lien', 'href'),
    })
  }
  return textbooks
}

/**
 * L'espace de stockage, aplati.
 *
 * Le service rend un arbre ; un téléphone n'a pas la place d'un explorateur de fichiers. Le
 * chemin du dossier est conservé sur chaque fichier, ce qui garde l'information sans imposer
 * la navigation.
 *
 * Les dossiers sont rendus **en plus** des fichiers, avec `file: false` : sans leur
 * identifiant, on ne peut rien créer dedans — et créer un dossier est une des rares écritures
 * réversibles que le service documente.
 */
export function parseCloud(data: unknown): CloudFile[] {
  const files: CloudFile[] = []
  const root = asObject(data)
  const start = root ? (root['ressources'] ?? root['children'] ?? root['data'] ?? []) : data
  walk(start, '', files)
  return files
}

function walk(value: unknown, path: string, into: CloudFile[]): void {
  for (const raw of objects(value)) {
    const name = pickText(raw, 'libelle', 'nom', 'name')
    if (name === '') continue
    const type = pickText(raw, 'typeRessource', 'type').toLowerCase()
    const children = raw['children'] ?? raw['ressources'] ?? raw['contenu']
    const isFolder = type.includes('folder') || type.includes('dossier') || Array.isArray(children)
    if (isFolder) {
      const id = pickText(raw, 'id')
      // Un dossier sans identifiant ne sert à rien : on ne peut ni le viser, ni y créer.
      if (id !== '') {
        into.push({ id, name, folder: path, ownerId: pickText(raw, 'idProprietaire', 'ownerId'), file: false })
      }
      walk(children, path === '' ? name : `${path} / ${name}`, into)
      continue
    }
    const file: CloudFile = {
      id: pickText(raw, 'id'),
      name,
      folder: path,
      ownerId: pickText(raw, 'idProprietaire', 'ownerId'),
      file: true,
    }
    if (file.id === '') continue
    const date = pickDate(raw, 'date', 'dateModification')
    if (date) file.date = date
    const size = pickNumber(raw, 'taille', 'size')
    if (size !== undefined) file.size = size
    into.push(file)
  }
}
