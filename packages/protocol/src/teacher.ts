import { type ApiResult, failure } from './codes.js'
import { type EcoleDirecteClient } from './client.js'
import type { Account, Lesson, MessageFolder, MessageItem } from './models.js'
import { MESSAGE_FOLDER_PARAM } from './models.js'
import { objects, pickText } from './parse/json.js'
import { type MessagesPayload, parseMessageDetail, parseMessages } from './parse/messages.js'
import { parseCatalog, parseGradebook, parseLessonSlots, parsePupils } from './parse/teacher.js'
import { parseTimetable } from './parse/timetable.js'
import type { EntityKind, Gradebook, LessonSlot, Pupil, TeacherCatalog } from './teaching.js'
import { schoolYear } from './teaching.js'

function map<T>(result: ApiResult<unknown>, parse: (value: unknown) => T): ApiResult<T> {
  return result.ok ? { ok: true, value: parse(result.value) } : result
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Le segment matière d'une route de notes : `code¤sous-code`.
 *
 * Le `¤` part encodé comme le site l'envoie (`%C2%A4`), et il est présent même sans
 * sous-matière. Un code qui le contient déjà est gardé tel quel.
 */
export function subjectSegment(code: string, subCode = ''): string {
  const trimmed = code.trim()
  return encodeURIComponent(trimmed.includes('¤') ? trimmed : `${trimmed}¤${subCode.trim()}`)
}

/**
 * Les appels de l'espace professeur, **en lecture seule**.
 *
 * Tous visent l'hôte enseignant, et aucun ne passe par la police d'écriture : aucune écriture
 * professeur n'est documentée, et celles qui existent (notes, appel, cahier de textes)
 * touchent le dossier scolaire d'élèves. Elles n'ont rien à faire ici tant qu'elles n'ont pas
 * été observées et éprouvées sur le compte d'un professeur volontaire.
 */
export class TeacherApi {
  constructor(private readonly client: EcoleDirecteClient) {}

  /**
   * L'emploi du temps du professeur.
   *
   * Même forme que celui d'un élève, mais ce qui distingue deux cours n'est plus le
   * professeur — c'est soi-même — : c'est la classe. Elle prend donc la place du groupe quand
   * le cours n'en a pas.
   */
  async timetable(account: Account, from: string, to: string): Promise<ApiResult<Lesson[]>> {
    const result = await this.client.call(`/P/${account.id}/emploidutemps.awp`, {
      verb: 'get',
      host: 'teacher',
      body: { dateDebut: from, dateFin: to, avecTrous: false },
    })
    return map(result, (value) =>
      parseTimetable(
        objects(value).map((raw) => ({
          ...raw,
          libelleGroupe: pickText(raw, 'libelleGroupe', 'groupe', 'classe', 'classeCode', 'groupeCode'),
        })),
      ),
    )
  }

  /** La carte de l'enseignement : établissements, classes, groupes, périodes et matières. */
  async catalog(account: Account): Promise<ApiResult<TeacherCatalog>> {
    const result = await this.client.call('/niveauxListe.awp', { verb: 'get', host: 'teacher' })
    return map(result, (value) => parseCatalog(value, { id: account.id, profile: account.teacher }))
  }

  /**
   * Les élèves d'une classe ou d'un groupe.
   *
   * La route de classe est la mieux attestée. Celle de groupe n'est vue qu'avec un créneau
   * d'appel dans le corps : sans lui, sa réponse n'est pas confirmée.
   */
  async pupils(group: { kind: EntityKind; id: string }): Promise<ApiResult<Pupil[]>> {
    const segment = group.kind === 'G' ? 'groupes' : 'classes'
    const result = await this.client.call(`/${segment}/${encodeURIComponent(group.id)}/eleves.awp`, {
      verb: 'get',
      host: 'teacher',
    })
    return map(result, parsePupils)
  }

  /** Les séances du cahier de textes entre deux dates incluses. L'identifiant du professeur n'y figure pas. */
  async lessonSlots(from: string, to: string): Promise<ApiResult<LessonSlot[]>> {
    if (!ISO_DAY.test(from) || !ISO_DAY.test(to) || from > to) {
      return failure('protocol', 'Période du cahier de textes invalide.', `${from} → ${to}`)
    }
    const result = await this.client.call(`/cahierdetexte/loadslots/${from}/${to}.awp`, {
      verb: 'get',
      host: 'teacher',
    })
    return map(result, parseLessonSlots)
  }

  /**
   * La grille de notes d'une classe ou d'un groupe, pour une période et une matière.
   *
   * Les trois codes viennent du catalogue : les deviner fait répondre « accès refusé ».
   */
  async gradebook(
    account: Account,
    group: { kind: EntityKind; id: string },
    periodCode: string,
    subjectCode: string,
    subCode = '',
  ): Promise<ApiResult<Gradebook>> {
    const path =
      `/enseignants/${account.id}/${group.kind}/${encodeURIComponent(group.id)}` +
      `/periodes/${encodeURIComponent(periodCode)}/matieres/${subjectSegment(subjectCode, subCode)}/notes.awp`
    const result = await this.client.call(path, { verb: 'get', host: 'teacher' })
    return map(result, parseGradebook)
  }

  /** Une page de la messagerie enseignant : même forme que celle des familles, autre hôte. */
  async messages(
    account: Account,
    options: { folder: MessageFolder; page?: number; perPage?: number },
  ): Promise<ApiResult<MessagesPayload>> {
    const result = await this.client.call(`/enseignants/${account.id}/messages.awp`, {
      verb: 'get',
      host: 'teacher',
      query: {
        force: false,
        typeRecuperation: MESSAGE_FOLDER_PARAM[options.folder],
        idClasseur: 0,
        orderBy: 'date',
        order: 'desc',
        query: '',
        onlyRead: '',
        page: options.page ?? 0,
        itemsPerPage: options.perPage ?? 50,
        getAll: 0,
      },
    })
    return map(result, (value) => parseMessages(value, options.folder))
  }

  /**
   * Le corps d'un message. Comme sur le site, l'ouvrir **le marque lu** côté ÉcoleDirecte.
   *
   * L'année des messages est celle en cours, qui bascule en août : elle se calcule à partir
   * du jour de l'établissement, jamais de l'horloge du serveur.
   */
  async messageDetail(
    account: Account,
    id: string,
    folder: MessageFolder,
    today: string,
  ): Promise<ApiResult<MessageItem>> {
    const result = await this.client.call(`/enseignants/${account.id}/messages/${encodeURIComponent(id)}.awp`, {
      verb: 'get',
      host: 'teacher',
      query: { mode: folder === 'sent' ? 'expediteur' : 'destinataire' },
      body: { anneeMessages: schoolYear(today) },
    })
    if (!result.ok) return result
    const message = parseMessageDetail(result.value, folder)
    return message ? { ok: true, value: message } : failure('protocol', 'Message illisible.')
  }
}
