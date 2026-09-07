import { type ApiResult, failure } from './codes.js'
import { type EcoleDirecteClient } from './client.js'
import { base64Encode, formBody } from './encoding.js'
import type {
  Account,
  Attachment,
  CloudFile,
  Document,
  HomeworkItem,
  Lesson,
  MessageFolder,
  MessageItem,
  NewsItem,
  SchoolLifeEvent,
  Textbook,
} from './models.js'
import { MESSAGE_FOLDER_PARAM, apiDownloadType, mailboxId, mailboxSegment } from './models.js'
import { type DayContent, parseDayContent, parseHomeworkSummary } from './parse/homework.js'
import { type GradesPayload, parseGrades } from './parse/grades.js'
import { type MessagesPayload, parseMessageDetail, parseMessages } from './parse/messages.js'
import { parseCloud, parseDocuments, parseNews, parseTextbooks } from './parse/modules.js'
import { parseSchoolLife } from './parse/schoollife.js'
import { parseTimetable } from './parse/timetable.js'
import { NetworkFailure } from './transport.js'

export interface DownloadedFile {
  name: string
  bytes: Uint8Array
  contentType: string
}

function map<T>(result: ApiResult<unknown>, parse: (value: unknown) => T): ApiResult<T> {
  return result.ok ? { ok: true, value: parse(result.value) } : result
}

/**
 * Les appels métier.
 *
 * Une classe mince posée sur le client : elle sait quel chemin, quel verbe et quel
 * identifiant pour chaque module, et rien d'autre. Les lecteurs sont dans `parse/`, le
 * protocole dans `client.ts`. Séparer les trois, c'est pouvoir en changer un sans toucher
 * aux deux autres.
 */
export class EcoleDirecteApi {
  constructor(private readonly client: EcoleDirecteClient) {}

  // ——————————————————————————————————————————————————— lecture

  async timetable(account: Account, from: string, to: string): Promise<ApiResult<Lesson[]>> {
    const result = await this.client.call(`/E/${account.id}/emploidutemps.awp`, {
      verb: 'get',
      // `avecTrous: false` : les trous sont calculés côté application, à partir des cours.
      body: { dateDebut: from, dateFin: to, avecTrous: false },
    })
    return map(result, parseTimetable)
  }

  async homework(account: Account): Promise<ApiResult<HomeworkItem[]>> {
    const result = await this.client.call(`/Eleves/${account.id}/cahierdetexte.awp`, { verb: 'get' })
    return map(result, parseHomeworkSummary)
  }

  /** Le détail d'un jour : les énoncés et le contenu de séance, absents du résumé. */
  async dayContent(account: Account, date: string): Promise<ApiResult<DayContent>> {
    const result = await this.client.call(`/Eleves/${account.id}/cahierdetexte/${date}.awp`, { verb: 'get' })
    return map(result, (value) => parseDayContent(value, date))
  }

  async grades(account: Account): Promise<ApiResult<GradesPayload>> {
    const result = await this.client.call(`/eleves/${account.id}/notes.awp`, {
      verb: 'get',
      body: { anneeScolaire: '' },
    })
    return map(result, parseGrades)
  }

  async schoolLife(account: Account): Promise<ApiResult<SchoolLifeEvent[]>> {
    const result = await this.client.call(`/eleves/${account.id}/viescolaire.awp`, { verb: 'get' })
    return map(result, parseSchoolLife)
  }

  async documents(account: Account): Promise<ApiResult<Document[]>> {
    const result = await this.client.call('/elevesDocuments.awp', {
      verb: 'get',
      body: { anneeScolaire: '', idEleve: account.id },
    })
    return map(result, parseDocuments)
  }

  /**
   * Une page de la messagerie.
   *
   * L'année entière dépasse largement une page : elle se charge à la demande, jamais d'un
   * coup à l'ouverture. Et c'est bien la boîte du **titulaire de la connexion** qui est
   * interrogée : celle de la famille pour un parent, pas celle de l'enfant.
   */
  async messages(
    account: Account,
    options: { folder: MessageFolder; page?: number; perPage?: number; classifierId?: string } ,
  ): Promise<ApiResult<MessagesPayload>> {
    const query: Record<string, string | number | boolean> = {
      force: false,
      typeRecuperation: MESSAGE_FOLDER_PARAM[options.folder],
      orderBy: 'date',
      order: 'desc',
      page: options.page ?? 0,
      itemsPerPage: options.perPage ?? 50,
      onlyRead: false,
      query: '',
    }
    if (options.classifierId) query['idClasseur'] = options.classifierId
    const result = await this.client.call(`/${mailboxSegment(account)}/${mailboxId(account)}/messages.awp`, {
      verb: 'get',
      query,
      body: { anneeMessages: '' },
    })
    return map(result, (value) => parseMessages(value, options.folder))
  }

  /**
   * Le corps complet d'un message.
   *
   * Cet appel est celui du site, et il **marque le message lu côté ÉcoleDirecte** : l'état
   * local n'est qu'un miroir immédiat, le serveur reprend la main à la synchronisation
   * suivante. Le `mode` dit de quel côté on se place — destinataire dans les reçus,
   * expéditeur dans les envoyés — et se tromper renvoie une réponse vide.
   */
  async messageDetail(account: Account, id: string, folder: MessageFolder): Promise<ApiResult<MessageItem>> {
    const result = await this.client.call(`/${mailboxSegment(account)}/${mailboxId(account)}/messages/${id}.awp`, {
      verb: 'get',
      query: { mode: folder === 'sent' ? 'expediteur' : 'destinataire' },
    })
    if (!result.ok) return result
    const message = parseMessageDetail(result.value, folder)
    return message ? { ok: true, value: message } : failure('protocol', 'Message illisible.')
  }

  async news(account: Account): Promise<ApiResult<NewsItem[]>> {
    const result = await this.client.call(`/E/${account.id}/viedeletablissement.awp`, { verb: 'get' })
    return map(result, parseNews)
  }

  async textbooks(account: Account): Promise<ApiResult<Textbook[]>> {
    const result = await this.client.call(`/E/${account.id}/manuelsnumeriques.awp`, { verb: 'get' })
    return map(result, parseTextbooks)
  }

  async cloud(account: Account): Promise<ApiResult<CloudFile[]>> {
    const result = await this.client.call(`/${mailboxSegment(account)}/${mailboxId(account)}/cloud.awp`, {
      verb: 'get',
    })
    return map(result, parseCloud)
  }

  // ——————————————————————————————————————————————————— écriture

  /**
   * Coche ou décoche des devoirs.
   *
   * La seule écriture qu'ÉcoleDirecte documente clairement, et la seule réversible sans
   * conséquence : c'est donc par elle que commence l'épreuve du réel. Elle passe malgré tout
   * par la police d'écriture, comme les autres.
   */
  async setHomeworkDone(account: Account, ids: string[], done: boolean): Promise<ApiResult<unknown>> {
    if (ids.length === 0) return { ok: true, value: null }
    const numeric = ids.map((id) => Number(id)).filter((id) => Number.isFinite(id))
    return this.client.call(`/Eleves/${account.id}/cahierdetexte.awp`, {
      verb: 'put',
      write: true,
      body: {
        idDevoirsEffectues: done ? numeric : [],
        idDevoirsNonEffectues: done ? [] : numeric,
      },
    })
  }

  /** Commente un devoir ou un contenu de séance. Le message part encodé en base64. */
  async commentHomework(account: Account, contentId: string, message: string): Promise<ApiResult<unknown>> {
    return this.client.call(`/eleves/${account.id}/afaire/commentaires.awp`, {
      verb: 'post',
      write: true,
      body: { message: base64Encode(message), idContenu: Number(contentId) },
    })
  }

  /** Crée un dossier dans l'espace de stockage. Réversible : la suppression existe. */
  async createCloudFolder(account: Account, parentId: string, name: string): Promise<ApiResult<unknown>> {
    return this.client.call(`/cloud/E/${account.id}.awp`, {
      verb: 'post',
      write: true,
      body: { parentNode: { id: parentId }, libelle: name, typeRessource: 'folder' },
    })
  }

  async renameCloudNode(account: Account, nodeId: string, name: string): Promise<ApiResult<unknown>> {
    return this.client.call(`/cloud/E/${account.id}.awp`, {
      verb: 'put',
      write: true,
      body: { node: { id: nodeId }, newLibelle: name },
    })
  }

  async deleteCloudNodes(account: Account, nodeIds: string[]): Promise<ApiResult<unknown>> {
    if (nodeIds.length === 0) return { ok: true, value: null }
    return this.client.call(`/cloud/E/${account.id}.awp`, {
      verb: 'delete',
      write: true,
      body: { tabNodes: nodeIds.map((id) => ({ id })) },
    })
  }

  // ——————————————————————————————————————————————————— téléchargement

  /**
   * Une pièce jointe, en octets.
   *
   * Le service répond parfois un petit JSON d'erreur au lieu du fichier — un refus déguisé
   * en réussite. On le détecte à la taille et au type, faute de quoi on enregistrerait un
   * message d'erreur sous le nom du devoir.
   */
  async download(attachment: Attachment): Promise<ApiResult<DownloadedFile>> {
    const engine = this.client.engineForDownload()
    if (!engine) return failure('protocol', 'Ce moteur ne sait pas télécharger.')
    const url = this.client.downloadUrl(attachment.id, apiDownloadType(attachment))
    let response
    try {
      response = await engine({
        method: 'POST',
        url,
        headers: this.client.downloadHeaders(),
        body: formBody({ forceDownload: 0 }),
      })
    } catch (error) {
      return failure('network', error instanceof NetworkFailure ? error.message : 'Le service est injoignable.')
    }
    const contentType = response.headers['content-type']?.[0] ?? ''
    if (contentType.includes('application/json')) {
      return failure('access-denied', "Le service a refusé ce fichier.")
    }
    return {
      ok: true,
      value: { name: attachment.name, bytes: response.bytes, contentType: contentType || 'application/octet-stream' },
    }
  }
}
