<script lang="ts">
  import EnTete from '$lib/components/EnTete.svelte'
  import Actualiser from '$lib/components/Actualiser.svelte'
  import Vide from '$lib/components/Vide.svelte'
  import ErreurSection from '$lib/components/ErreurSection.svelte'
  import { longDate } from '@ecole2recte/protocol'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  const categories = $derived([...new Set(data.documents.map((doc) => doc.category))])
</script>

<svelte:head><title>Documents — ecole2recte</title></svelte:head>

<EnTete
  surtitre="Espace numérique"
  titre="Documents"
  soustitre={`${data.documents.length} document${data.documents.length > 1 ? 's' : ''}`}
>
  {#snippet actions()}<Actualiser />{/snippet}
</EnTete>

{#if data.erreur}
  <ErreurSection message="Les documents n’ont pas pu être chargés." cause={data.erreur.message} />
{/if}

{#each categories as categorie (categorie)}
  <section class="panneau" style="margin-bottom:16px">
    <div class="tete-panneau"><h2>{categorie}</h2></div>
    <div class="corps-panneau serre">
      {#each data.documents.filter((doc) => doc.category === categorie) as document (document.id)}
        <a
          class="ligne"
          href={`/piece-jointe/resource/${document.id}?nom=${encodeURIComponent(document.name)}&type=${encodeURIComponent(document.type)}`}
        >
          <span class="texte">
            <span style="font-weight:600">{document.name}</span>
            {#if document.date}<span class="discret">{longDate(document.date)}</span>{/if}
          </span>
          <span class="jeton">{document.type || 'Fichier'}</span>
        </a>
      {/each}
    </div>
  </section>
{:else}
  <Vide titre="Aucun document" description="L’établissement n’a rien publié, ou le module est fermé." />
{/each}

<style>
  .ligne {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 11px 14px;
    border-bottom: 1px solid var(--bordure-douce);
    text-decoration: none;
    color: inherit;
  }
  .ligne:last-child { border-bottom: 0; }
  .ligne:hover { background: var(--surface-2); }
  .texte { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
</style>
