<script lang="ts">
  import EnTete from '$lib/components/EnTete.svelte'
  import Vide from '$lib/components/Vide.svelte'
  import ErreurSection from '$lib/components/ErreurSection.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()

  const classes = $derived(data.groupes.filter((groupe) => groupe.type === 'C').length)
  const groupes = $derived(data.groupes.length - classes)
</script>

<svelte:head><title>Classes — ecole2recte</title></svelte:head>

<EnTete
  surtitre="Enseignement"
  titre="Classes et groupes"
  soustitre={`${classes} classe${classes > 1 ? 's' : ''} · ${groupes} groupe${groupes > 1 ? 's' : ''}`}
/>

{#if data.erreur}
  <ErreurSection
    message="Le détail des classes n’a pas pu être chargé : la liste vient du profil de connexion."
    cause={data.erreur}
  />
{/if}

<div class="liste">
  {#each data.groupes as groupe (groupe.cle)}
    <article class="carte pile" style="gap:8px">
      <div class="rangee" style="align-items:baseline;flex-wrap:wrap">
        <h2 style="flex:1">{groupe.libelle}</h2>
        {#if groupe.pp}<span class="jeton accent">Professeur principal</span>{/if}
      </div>
      <p class="discret">
        {groupe.type === 'C' ? 'Classe' : 'Groupe'}{groupe.code ? ` · ${groupe.code}` : ''}{groupe.periode ? ` · ${groupe.periode}` : ''}
      </p>
      <div class="rangee" style="flex-wrap:wrap;gap:8px">
        <a class="pastille" href={`/prof/classes/${groupe.cle}`}>Élèves</a>
        {#if groupe.notee}<a class="pastille" href={`/prof/notes?groupe=${groupe.cle}`}>Notes</a>{/if}
        <a class="pastille" href={`/prof/cahier-de-textes?groupe=${groupe.cle}`}>Cahier de textes</a>
      </div>
    </article>
  {:else}
    <Vide titre="Aucune classe" description="Le profil de connexion ne déclare aucune classe ni aucun groupe." />
  {/each}
</div>

<style>
  .liste { display: grid; gap: 12px; }
  @media (min-width: 700px) { .liste { grid-template-columns: repeat(2, 1fr); } }
</style>
