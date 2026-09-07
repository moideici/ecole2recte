import type { SessionRecord } from '$lib/server/store.js'

declare global {
  namespace App {
    interface Locals {
      sessionId: string | null
      session: SessionRecord | null
    }
  }
}

export {}
