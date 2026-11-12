import { AsyncLocalStorage } from 'node:async_hooks'

/** Un contexte par requête évite de mélanger les erreurs de deux utilisateurs. */
export const lecture = new AsyncLocalStorage<{ causes: string[]; dates: number[] }>()

export function observerLecture(date: number, cause?: string): void {
  const contexte = lecture.getStore()
  contexte?.dates.push(date)
  if (cause) contexte?.causes.push(cause)
}
