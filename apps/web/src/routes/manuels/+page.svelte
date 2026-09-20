<script lang="ts">
  import EnTete from '$lib/components/EnTete.svelte'
  import Actualiser from '$lib/components/Actualiser.svelte'
  import Vide from '$lib/components/Vide.svelte'
  import ErreurSection from '$lib/components/ErreurSection.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
</script>

<svelte:head><title>Manuels numériques — ecole2recte</title></svelte:head>

<EnTete surtitre="Ressources" titre="Manuels numériques"
>
  {#snippet actions()}<Actualiser />{/snippet}
</EnTete>

{#if data.erreur}
  <ErreurSection
    message="Les manuels ne sont pas accessibles."
    cause={`${data.erreur.message} Ce module peut simplement ne pas être ouvert par l’établissement.`}
  />
{/if}

<div class="grille">
  {#each data.manuels as manuel (manuel.id)}
    {#if manuel.url}
      <!-- Le manuel s'ouvre chez son éditeur : `noopener` pour ne pas lui donner la main
           sur notre onglet. -->
      <a class="carte" href={manuel.url} target="_blank" rel="noopener noreferrer">
        <p style="font-weight:600">{manuel.title}</p>
        <p class="discret">{[manuel.subject, manuel.publisher].filter(Boolean).join(' · ')}</p>
        <p class="discret" style="margin-top:6px">Ouvrir chez l’éditeur ↗</p>
      </a>
    {:else}
      <div class="carte">
        <p style="font-weight:600">{manuel.title}</p>
        <p class="discret">{[manuel.subject, manuel.publisher].filter(Boolean).join(' · ')}</p>
      </div>
    {/if}
  {:else}
    <Vide titre="Aucun manuel" description="Rien n’est associé à ce compte, ou le module est fermé." />
  {/each}
</div>

<style>
  .grille { display: grid; gap: 12px; grid-template-columns: 1fr; }
  @media (min-width: 700px) { .grille { grid-template-columns: repeat(2, 1fr); } }
  a.carte { text-decoration: none; }
</style>
