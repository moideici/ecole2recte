<script lang="ts">
  import { enhance } from '$app/forms'
  import EnTete from '$lib/components/EnTete.svelte'
  import Actualiser from '$lib/components/Actualiser.svelte'
  import Vide from '$lib/components/Vide.svelte'
  import ErreurSection from '$lib/components/ErreurSection.svelte'
  import { longDate, matches } from '@ecole2recte/protocol'
  import type { ActionData, PageData } from './$types'

  let { data, form }: { data: PageData; form: ActionData } = $props()
  let recherche = $state('')
  /** Le fichier en cours de renommage : un seul à la fois. */
  let renomme = $state('')

  const visibles = $derived(data.fichiers.filter((fichier) => matches(recherche, fichier.name, fichier.folder)))

  function taille(octets: number | undefined): string {
    if (octets === undefined) return ''
    if (octets < 1024) return `${octets} o`
    if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} ko`
    return `${(octets / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`
  }
</script>

<svelte:head><title>Espace de stockage — ecole2recte</title></svelte:head>

<EnTete
  surtitre="Ressources"
  titre="Espace de stockage"
  soustitre={`${data.fichiers.length} fichier${data.fichiers.length > 1 ? 's' : ''}`}
>
  {#snippet actions()}
    <Actualiser />
  {/snippet}
</EnTete>

{#if form && 'message' in form && form.message}
  <p class="erreur" role="alert" style="margin-bottom:14px">{form.message}</p>
{/if}
{#if form && 'cree' in form && form.cree}
  <p class="jeton succes" role="status" style="margin-bottom:14px">Dossier « {form.cree} » créé.</p>
{/if}
{#if form && 'renomme' in form && form.renomme}
  <p class="jeton succes" role="status" style="margin-bottom:14px">Renommé en « {form.renomme} ».</p>
{/if}

<label class="pile" style="gap:6px;margin-bottom:14px;max-width:420px">
  <span class="minuscule">Rechercher</span>
  <input class="champ" bind:value={recherche} type="search" placeholder="Un nom, un dossier…" />
</label>

{#if data.erreur}
  <ErreurSection
    message="L’espace de stockage n’est pas accessible."
    cause={`${data.erreur.message} Ce module peut simplement ne pas être ouvert par l’établissement.`}
  />
{/if}

{#if data.creable}
  <section class="panneau" style="margin-bottom:16px">
    <div class="tete-panneau"><h2>Nouveau dossier</h2></div>
    <div class="corps-panneau">
      {#if data.dossiers.length === 0}
        <p class="discret">
          Aucun dossier connu : le service n’en a rendu aucun avec un identifiant, et on ne
          sait donc pas où créer.
        </p>
      {:else}
        <form method="POST" action="?/dossier" class="formulaire" use:enhance>
          <label class="pile" style="gap:4px;flex:1;min-width:190px">
            <span class="minuscule">Dans</span>
            <select class="champ" name="parent">
              {#each data.dossiers as dossier (dossier.id)}
                <option value={dossier.id}>{dossier.folder ? `${dossier.folder} / ` : ''}{dossier.name}</option>
              {/each}
            </select>
          </label>
          <label class="pile" style="gap:4px;flex:1;min-width:190px">
            <span class="minuscule">Nom du dossier</span>
            <input class="champ" name="nom" required maxlength="80" />
          </label>
          <button class="bouton primaire">Créer</button>
        </form>
      {/if}
    </div>
  </section>
{/if}

<section class="panneau">
  <div class="tete-panneau">
    <h2>Fichiers</h2>
    <span class="espace"></span>
    <span class="discret">{visibles.length}</span>
  </div>
  <div class="corps-panneau serre">
    {#each visibles as fichier (fichier.id)}
      <div class="ligne">
        {#if renomme === fichier.id}
          <form method="POST" action="?/renommer" class="renommage" use:enhance={() => async ({ update }) => {
            await update()
            renomme = ''
          }}>
            <input type="hidden" name="noeud" value={fichier.id} />
            <input class="champ" name="nom" value={fichier.name} required maxlength="120" aria-label="Nouveau nom" />
            <button class="bouton primaire">Renommer</button>
            <button class="bouton" type="button" onclick={() => (renomme = '')}>Annuler</button>
          </form>
        {:else}
          <a
            class="texte"
            href={`/piece-jointe/resource/${fichier.id}?nom=${encodeURIComponent(fichier.name)}&type=CLOUD`}
          >
            <span style="font-weight:600">{fichier.name}</span>
            <!-- L'arborescence est aplatie : le chemin reste, la navigation disparaît. -->
            {#if fichier.folder}<span class="discret">{fichier.folder}</span>{/if}
          </a>
          <span class="meta discret">
            {#if fichier.date}<span>{longDate(fichier.date)}</span>{/if}
            {#if fichier.size !== undefined}<span class="nombre">{taille(fichier.size)}</span>{/if}
          </span>
          {#if data.renommable}
            <button class="bouton petit" onclick={() => (renomme = fichier.id)}>Renommer</button>
          {/if}
        {/if}
      </div>
    {:else}
      <div style="padding:14px">
        <Vide titre="Aucun fichier" description="Rien n’est partagé, ou le module est fermé." />
      </div>
    {/each}
  </div>
</section>

<style>
  .formulaire { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; }

  .ligne {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 14px;
    border-bottom: 1px solid var(--bordure-douce);
  }
  .ligne:last-child { border-bottom: 0; }
  .ligne:hover { background: var(--surface-2); }
  .texte { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; text-decoration: none; color: inherit; }
  .meta { text-align: right; display: flex; flex-direction: column; gap: 2px; white-space: nowrap; }
  .petit { min-height: 36px; padding: 0 12px; font-size: 0.85rem; }
  .renommage { display: flex; gap: 8px; align-items: center; flex: 1; flex-wrap: wrap; }
  .renommage .champ { flex: 1; min-width: 180px; }
</style>
