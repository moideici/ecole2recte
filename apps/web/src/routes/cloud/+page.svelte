<script lang="ts">
  import EnTete from '$lib/components/EnTete.svelte'
  import Vide from '$lib/components/Vide.svelte'
  import ErreurSection from '$lib/components/ErreurSection.svelte'
  import { longDate, matches } from '@ecole2recte/protocol'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  let recherche = $state('')

  const visibles = $derived(data.fichiers.filter((fichier) => matches(recherche, fichier.name, fichier.folder)))

  function taille(octets: number | undefined): string {
    if (octets === undefined) return ''
    if (octets < 1024) return `${octets} o`
    if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} ko`
    return `${(octets / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`
  }
</script>

<svelte:head><title>Espace de stockage — ecole2recte</title></svelte:head>

<EnTete surtitre="Ressources" titre="Espace de stockage" soustitre={`${data.fichiers.length} fichier${data.fichiers.length > 1 ? 's' : ''}`} />

<label class="pile" style="gap:6px;margin-bottom:12px">
  <span class="minuscule">Rechercher</span>
  <input class="champ" bind:value={recherche} type="search" placeholder="Un nom, un dossier…" />
</label>

{#if data.erreur}
  <ErreurSection
    message="L’espace de stockage n’est pas accessible."
    cause={`${data.erreur.message} Ce module peut simplement ne pas être ouvert par l’établissement.`}
  />
{/if}

<div class="pile">
  {#each visibles as fichier (fichier.id)}
    <a
      class="carte rangee"
      href={`/piece-jointe/resource/${fichier.id}?nom=${encodeURIComponent(fichier.name)}&type=CLOUD`}
      style="align-items:flex-start"
    >
      <div style="flex:1;min-width:0">
        <p style="font-weight:600">{fichier.name}</p>
        <!-- L'arborescence est aplatie : le chemin reste, la navigation disparaît. -->
        {#if fichier.folder}<p class="discret">{fichier.folder}</p>{/if}
      </div>
      <div style="text-align:right">
        {#if fichier.date}<p class="discret">{longDate(fichier.date)}</p>{/if}
        {#if fichier.size !== undefined}<p class="discret">{taille(fichier.size)}</p>{/if}
      </div>
    </a>
  {:else}
    <Vide titre="Aucun fichier" description="Rien n’est partagé, ou le module est fermé." />
  {/each}
</div>

<style>a.carte { text-decoration: none; }</style>
