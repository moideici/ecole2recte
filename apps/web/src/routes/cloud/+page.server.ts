import { fail } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { EcoleDirecteApi } from '@ecole2recte/protocol'
import { clientFor, invalidate, loadSections, today } from '$lib/server/api.js'
import { peutEcrire, requireStudent } from '$lib/server/guard.js'

export const load: PageServerLoad = async ({ locals, url }) => {
  const garde = requireStudent(locals)
  const { id, record, account } = garde
  const force = url.searchParams.get('rafraichir') === '1'
  const { snapshot, errors } = await loadSections(id, record, account, ['cloud'], { today: today(), force })

  // Les dossiers ne se téléchargent pas ; ils servent de destination à une création.
  const entrees = snapshot.cloudFiles
  return {
    fichiers: entrees.filter((entree) => entree.file),
    dossiers: entrees.filter((entree) => !entree.file),
    erreur: errors.cloud ?? null,
    // Écrire dans l'espace de l'élève depuis une vue parent serait agir à sa place.
    creable: peutEcrire(garde, 'cloud-folder'),
    renommable: peutEcrire(garde, 'cloud-rename'),
  }
}

export const actions: Actions = {
  /** Créer un dossier : réversible côté service, et sans effet sur ce qui existe. */
  dossier: async ({ request, locals }) => {
    const garde = requireStudent(locals)
    const { id, record, account } = garde
    if (!peutEcrire(garde, 'cloud-folder')) {
      return fail(403, { message: "Créer un dossier n'est pas autorisé ici." })
    }
    const form = await request.formData()
    const parent = String(form.get('parent') ?? '')
    const nom = String(form.get('nom') ?? '').trim()
    if (parent === '') return fail(400, { message: 'Choisis un dossier où créer.' })
    if (nom === '') return fail(400, { message: 'Le nom est vide.' })

    const { api } = clientFor(record, id) as { api: EcoleDirecteApi }
    const result = await api.createCloudFolder(account, parent, nom)
    if (!result.ok) return fail(502, { message: result.message })
    await invalidate(id, record, account.id)
    return { cree: nom }
  },

  renommer: async ({ request, locals }) => {
    const garde = requireStudent(locals)
    const { id, record, account } = garde
    if (!peutEcrire(garde, 'cloud-rename')) {
      return fail(403, { message: "Renommer n'est pas autorisé ici." })
    }
    const form = await request.formData()
    const noeud = String(form.get('noeud') ?? '')
    const nom = String(form.get('nom') ?? '').trim()
    if (noeud === '') return fail(400, { message: 'Fichier inconnu.' })
    if (nom === '') return fail(400, { message: 'Le nom est vide.' })

    const { api } = clientFor(record, id) as { api: EcoleDirecteApi }
    const result = await api.renameCloudNode(account, noeud, nom)
    if (!result.ok) return fail(502, { message: result.message })
    await invalidate(id, record, account.id)
    return { renomme: nom }
  },
}
