import type { SessionNamespace, SessionRecord } from '$lib/server/store.js'

declare global {
  namespace App {
    interface Locals {
      sessionId: string | null
      session: SessionRecord | null
    }
    interface Platform {
      /**
       * Absent en développement et sur un déploiement Node classique : `store.ts` retombe
       * alors sur le magasin en mémoire. Présent sur Cloudflare — voir `wrangler.toml` et
       * `apps/sessions/`.
       */
      env?: { SESSIONS?: SessionNamespace }
    }
  }
}

export {}
