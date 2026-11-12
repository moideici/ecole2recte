import type { PageServerLoad } from './$types'
import { loadSections, loadDays, today } from '$lib/server/api.js'
import { requireStudent } from '$lib/server/guard.js'
import { rechercher } from '$lib/recherche.js'

export const load: PageServerLoad = async ({ locals, url }) => {
  const { id, record, account } = requireStudent(locals)
  const q = url.searchParams.get('q') ?? ''
  if (q.trim().length < 2) return { q, resultats: [], erreurs: [] }
  const jour = today()
  const { snapshot, errors } = await loadSections(id, record, account, ['homework', 'messages', 'grades'], { today: jour })
  const dates = [...new Set(snapshot.homework.map((item) => item.dueDate))]
  const aVenir = dates.filter((date) => date >= jour).sort().slice(0, 10)
  const passees = dates.filter((date) => date < jour).sort().reverse().slice(0, 10 - aVenir.length)
  const jours = await loadDays(id, record, account, [...aVenir, ...passees])
  const devoirs = snapshot.homework.map((item) => ({
    ...item,
    content: item.content || jours[item.dueDate]?.homework.find(
      (detail) => detail.id === item.id || (detail.subject === item.subject && detail.content !== ''),
    )?.content || '',
  }))
  return {
    q,
    resultats: rechercher(q, { devoirs, messages: snapshot.messages, notes: snapshot.grades }),
    erreurs: Object.values(errors).map((erreur) => erreur.message),
  }
}
