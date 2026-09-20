import { fail } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { clientFor, invalidate, loadDays, loadSections, today } from '$lib/server/api.js'
import { peutEcrire, requireStudent } from '$lib/server/guard.js'
import { EcoleDirecteApi } from '@ecole2recte/protocol'

/**
 * Combien de journées on enrichit d'un coup.
 *
 * Chaque journée est un appel : les charger toutes ferait une trentaine de requêtes pour
 * afficher une liste. On enrichit celles qu'on regarde vraiment — le travail qui vient —
 * et la fiche d'une journée charge la sienne à l'ouverture.
 */
const JOURNEES_ENRICHIES = 10

export const load: PageServerLoad = async ({ locals, url }) => {
  const garde = requireStudent(locals)
  const { id, record, account } = garde
  const jour = today()
  const force = url.searchParams.get('rafraichir') === '1'
  const { snapshot, errors } = await loadSections(id, record, account, ['homework'], { today: jour, force })

  // Le résumé ne porte pas les énoncés : ils arrivent avec le détail d'un jour. Sans cet
  // appel, la liste n'afficherait qu'une matière et une date.
  const aVenir = [...new Set(snapshot.homework.filter((item) => item.dueDate >= jour).map((item) => item.dueDate))]
    .sort()
    .slice(0, JOURNEES_ENRICHIES)
  const passees = [...new Set(snapshot.homework.filter((item) => item.dueDate < jour).map((item) => item.dueDate))]
    .sort()
    .reverse()
    .slice(0, Math.max(0, JOURNEES_ENRICHIES - aVenir.length))
  const jours = await loadDays(id, record, account, [...aVenir, ...passees])

  // L'énoncé du détail remplace celui du résumé, qui est vide neuf fois sur dix.
  const devoirs = snapshot.homework.map((item) => {
    const detail = jours[item.dueDate]?.homework.find(
      (entry) => entry.id === item.id || (entry.subject === item.subject && entry.content !== ''),
    )
    return {
      ...item,
      content: item.content || detail?.content || '',
      attachments: item.attachments.length > 0 ? item.attachments : (detail?.attachments ?? []),
      // Vrai quand la journée a été chargée : ailleurs, un énoncé vide veut dire « pas encore lu ».
      detaille: jours[item.dueDate] !== undefined,
    }
  })

  return {
    jour,
    devoirs,
    erreur: errors.homework ?? null,
    // Cocher n'est proposé que si l'écriture est ouverte **et** qu'on est bien l'élève :
    // depuis une vue parent, cocher enverrait au serveur un geste que l'enfant n'a pas fait.
    cochable: peutEcrire(garde, 'homework-done'),
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

    // Ce qui était affiché n'est plus vrai : le cache du profil est oublié.
    await invalidate(id, record, account.id)
    return { ok: true }
  },
}
