<script lang="ts">
  import EnTete from '$lib/components/EnTete.svelte'
  import Vide from '$lib/components/Vide.svelte'
  import ErreurSection from '$lib/components/ErreurSection.svelte'
  import { longDate } from '@ecole2recte/protocol'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  const categories = $derived([...new Set(data.documents.map((doc) => doc.category))])
</script>

<svelte:head><title>Documents — ecole2recte</title></svelte:head>

<EnTete surtitre="Espace numérique" titre="Documents" soustitre={`${data.documents.length} document${data.documents.length > 1 ? 's' : ''}`} />

{#if data.erreur}
  <ErreurSection message="Les documents n’ont pas pu être chargés." cause={data.erreur.message} />
{/if}

{#each categories as categorie (categorie)}
  <h2 style="margin:18px 0 8px">{categorie}</h2>
  <div class="pile">
    {#each data.documents.filter((doc) => doc.category === categorie) as document (document.id)}
      <a
        class="carte"
        href={`/piece-jointe/resource/${document.id}?nom=${encodeURIComponent(document.name)}&type=${encodeURIComponent(document.type)}`}
      >
        <p style="font-weight:600">{document.name}</p>
        {#if document.date}<p class="discret">{longDate(document.date)}</p>{/if}
      </a>
    {/each}
  </div>
{:else}
  <Vide titre="Aucun document" description="L’établissement n’a rien publié, ou le module est fermé." />
{/each}

<style>a.carte { text-decoration: none; }</style>
