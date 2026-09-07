import { fail } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { clientFor, invalidate, loadSections, today } from '$lib/server/api.js'
import { requireStudent } from '$lib/server/guard.js'
import { isWriteEnabled } from '$lib/server/write-policy.js'
import { EcoleDirecteApi, viewedByFamily } from '@ecole2recte/protocol'

export const load: PageServerLoad = async ({ locals }) => {
  const { id, record, account } = requireStudent(locals)
  const jour = today()
  const { snapshot, errors } = await loadSections(id, record, account, ['homework'], { today: jour })
  return {
    jour,
    devoirs: snapshot.homework,
    erreur: errors.homework ?? null,
    // Cocher n'est proposé que si l'écriture est ouverte **et** qu'on est bien l'élève :
    // depuis une vue parent, cocher enverrait au serveur un geste que l'enfant n'a pas fait.
    cochable: isWriteEnabled('homework-done') && !viewedByFamily(account),
  }
}

export const actions: Actions = {
  cocher: async ({ request, locals }) => {
    const { id, record, account } = requireStudent(locals)
    if (!isWriteEnabled('homework-done') || viewedByFamily(account)) {
      return fail(403, { message: "Cocher un devoir n'est pas autorisé ici." })
    }
    const form = await request.formData()
    const devoir = String(form.get('devoir') ?? '')
    const fait = String(form.get('fait') ?? '') === 'true'
    if (devoir === '') return fail(400, { message: 'Devoir inconnu.' })

    const { api } = clientFor(record) as { api: EcoleDirecteApi }
    const result = await api.setHomeworkDone(account, [devoir], fait)
    if (!result.ok) return fail(502, { message: result.message })

    // Ce qui était affiché n'est plus vrai : le cache du profil est oublié.
    invalidate(id, record, account.id)
    return { ok: true }
  },
}
