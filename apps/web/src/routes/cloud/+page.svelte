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

<section class="panneau">
  <div class="corps-panneau serre">
    {#each visibles as fichier (fichier.id)}
      <a class="ligne" href={`/piece-jointe/resource/${fichier.id}?nom=${encodeURIComponent(fichier.name)}&type=CLOUD`}>
        <span class="texte">
          <span style="font-weight:600">{fichier.name}</span>
          <!-- L'arborescence est aplatie : le chemin reste, la navigation disparaît. -->
          {#if fichier.folder}<span class="discret">{fichier.folder}</span>{/if}
        </span>
        <span class="meta discret">
          {#if fichier.date}<span>{longDate(fichier.date)}</span>{/if}
          {#if fichier.size !== undefined}<span class="nombre">{taille(fichier.size)}</span>{/if}
        </span>
      </a>
    {:else}
      <div style="padding:14px">
        <Vide titre="Aucun fichier" description="Rien n’est partagé, ou le module est fermé." />
      </div>
    {/each}
  </div>
</section>

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
  .meta { text-align: right; display: flex; flex-direction: column; gap: 2px; white-space: nowrap; }
</style>
