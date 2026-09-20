import { error, fail } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { EcoleDirecteApi, addDays } from '@ecole2recte/protocol'
import { clientFor, invalidate, loadDays, loadSections, today } from '$lib/server/api.js'
import { peutEcrire, requireStudent } from '$lib/server/guard.js'

/**
 * Une journée du cahier de textes.
 *
 * C'est l'écran qui manquait : le résumé dit qu'il y a du travail en mathématiques pour
 * mardi, cette page dit **lequel**, avec ses pièces jointes et ce qui a été fait en cours.
 */
export const load: PageServerLoad = async ({ locals, params }) => {
  const garde = requireStudent(locals)
  const { id, record, account } = garde
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) error(404, 'Journée inconnue.')

  const jour = today()
  const [{ snapshot }, jours] = await Promise.all([
    loadSections(id, record, account, ['homework', 'timetable'], { today: jour }),
    loadDays(id, record, account, [params.date]),
  ])
  const detail = jours[params.date]

  // Le résumé porte l'état « fait » et le dépôt en ligne ; le détail porte l'énoncé. Ni l'un
  // ni l'autre ne suffit seul, d'où la réunion des deux.
  const duResume = snapshot.homework.filter((item) => item.dueDate === params.date)
  const devoirs = duResume.map((item) => {
    const enonce = detail?.homework.find(
      (entry) => entry.id === item.id || (entry.subject === item.subject && entry.content !== ''),
    )
    return {
      ...item,
      content: item.content || enonce?.content || '',
      attachments: item.attachments.length > 0 ? item.attachments : (enonce?.attachments ?? []),
    }
  })
  // Un devoir que le résumé ignore mais que le détail connaît reste affiché.
  const connus = new Set(duResume.map((item) => item.id))
  const supplementaires = (detail?.homework ?? []).filter((entry) => !connus.has(entry.id))

  return {
    jour,
    date: params.date,
    precedent: addDays(params.date, -1),
    suivant: addDays(params.date, 1),
    devoirs: [...devoirs, ...supplementaires],
    seances: detail?.sessions ?? [],
    cours: snapshot.lessons.filter((lesson) => lesson.start.slice(0, 10) === params.date),
    // Le détail n'a pas répondu : le dire évite de faire croire à une journée vide.
    charge: detail !== undefined,
    cochable: peutEcrire(garde, 'homework-done'),
    commentable: peutEcrire(garde, 'homework-comment'),
  }
}

export const actions: Actions = {
  cocher: async ({ request, locals }) => {
    const garde = requireStudent(locals)
    const { id, record, account } = garde
    if (!peutEcrire(garde, 'homework-done')) {
      return fail(403, { message: "Cocher un devoir n'est pas autorisé ici." })
    }
    const form = await request.formData()
    const devoir = String(form.get('devoir') ?? '')
    const fait = String(form.get('fait') ?? '') === 'true'
    if (devoir === '') return fail(400, { message: 'Devoir inconnu.' })

    const { api } = clientFor(record, id) as { api: EcoleDirecteApi }
    const result = await api.setHomeworkDone(account, [devoir], fait)
    if (!result.ok) return fail(502, { message: result.message })
    await invalidate(id, record, account.id)
    return { ok: true }
  },

  /**
   * Un commentaire part chez le professeur et ne se retire pas depuis ici : il est donc
   * envoyé tel quel, sans retouche, et l'interface le dit avant l'envoi.
   */
  commenter: async ({ request, locals }) => {
    const garde = requireStudent(locals)
    const { id, record, account } = garde
    if (!peutEcrire(garde, 'homework-comment')) {
      return fail(403, { message: "Commenter un devoir n'est pas autorisé ici." })
    }
    const form = await request.formData()
    const contenu = String(form.get('contenu') ?? '')
    const message = String(form.get('message') ?? '').trim()
    if (contenu === '') return fail(400, { message: 'Devoir inconnu.' })
    if (message === '') return fail(400, { message: 'Le commentaire est vide.' })

    const { api } = clientFor(record, id) as { api: EcoleDirecteApi }
    const result = await api.commentHomework(account, contenu, message)
    if (!result.ok) return fail(502, { message: result.message })
    await invalidate(id, record, account.id)
    return { commente: true }
  },
}
