/**
 * Le Durable Object des sessions.
 *
 * Un objet par session : `apps/web` l'adresse par `idFromName(id)`, où `id` est
 * l'identifiant opaque déjà posé dans le cookie `httpOnly`. Chaque objet ne connaît que
 * lui-même — il ne fait pas de liste, pas de recherche, juste lire/écrire/effacer un seul
 * document JSON — ce qui lui vaut d'être toujours la même instance qui répond, quelle que
 * soit l'isolate qui a reçu la requête HTTP entrante.
 *
 * Passé le délai d'inactivité, l'objet efface lui-même sa mémoire via une alarme : aucun
 * balayage global n'est nécessaire, contrairement au magasin en mémoire de `store.ts`.
 *
 * Le délai est celui que `apps/web` annonce à chaque écriture (`x-session-ttl`) : douze heures
 * par défaut, trente jours pour une session « rester connecté ». Une alarme fixe à douze heures
 * effaçait les identifiants scellés avant leur premier usage.
 */

const TTL_MS = 12 * 60 * 60 * 1000
// Un coffre d'appareil vit six mois : le plafond doit être au-dessus.
const TTL_MAX_MS = 200 * 24 * 60 * 60 * 1000

/** Le délai demandé, borné : un en-tête absurde ne doit pas rendre une session éternelle. */
function ttlDemande(request: Request): number {
  const demande = Number(request.headers.get('x-session-ttl'))
  if (!Number.isFinite(demande) || demande <= 0) return TTL_MS
  return Math.min(demande, TTL_MAX_MS)
}

export class SessionDurableObject {
  constructor(
    private readonly ctx: DurableObjectState,
    // Pas de binding utilisé ici : le second paramètre existe pour respecter la forme
    // attendue par Cloudflare.
    private readonly env: unknown,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url)

    if (request.method === 'GET' && pathname === '/read') {
      const record = await this.ctx.storage.get<string>('record')
      if (record === undefined) return new Response(null, { status: 404 })
      return new Response(record, { headers: { 'content-type': 'application/json' } })
    }

    if (request.method === 'PUT' && pathname === '/write') {
      const body = await request.text()
      await this.ctx.storage.put('record', body)
      await this.ctx.storage.setAlarm(Date.now() + ttlDemande(request))
      return new Response(null, { status: 204 })
    }

    if (request.method === 'DELETE' && pathname === '/destroy') {
      await this.ctx.storage.deleteAll()
      await this.ctx.storage.deleteAlarm()
      return new Response(null, { status: 204 })
    }

    return new Response('Route inconnue.', { status: 404 })
  }

  /** Le délai sans écriture est écoulé : la session est oubliée. */
  async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll()
  }
}
