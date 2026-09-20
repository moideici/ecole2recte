<script lang="ts">
  import EnTete from '$lib/components/EnTete.svelte'
  import Actualiser from '$lib/components/Actualiser.svelte'
  import Vide from '$lib/components/Vide.svelte'
  import ErreurSection from '$lib/components/ErreurSection.svelte'
  import { longDate } from '@ecole2recte/protocol'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
</script>

<svelte:head><title>Actualités — ecole2recte</title></svelte:head>

<EnTete surtitre="Vie de l’établissement" titre="Actualités"
>
  {#snippet actions()}<Actualiser />{/snippet}
</EnTete>

{#if data.erreur}
  <!-- Un module fermé n'est pas une panne : le dire une fois, ici, suffit. -->
  <ErreurSection
    message="Les actualités ne sont pas accessibles."
    cause={`${data.erreur.message} Ce module peut simplement ne pas être ouvert par l’établissement.`}
  />
{/if}

<div class="pile">
  {#each data.actualites as actualite (actualite.id)}
    <article class="carte">
      <p style="font-weight:650">{actualite.title}</p>
      <p class="discret">{[actualite.author, actualite.date ? longDate(actualite.date) : ''].filter(Boolean).join(' · ')}</p>
      {#if actualite.content}<p style="margin-top:8px;white-space:pre-wrap">{actualite.content}</p>{/if}
      {#each actualite.attachments as piece (piece.id)}
        <a
          style="display:inline-block;margin-top:8px;margin-right:10px"
          href={`/piece-jointe/${piece.source}/${piece.id}?nom=${encodeURIComponent(piece.name)}&type=${encodeURIComponent(piece.downloadType)}`}
        >{piece.name}</a>
      {/each}
    </article>
  {:else}
    <Vide titre="Aucune actualité" description="Rien n’a été publié, ou le module est fermé." />
  {/each}
</div>
