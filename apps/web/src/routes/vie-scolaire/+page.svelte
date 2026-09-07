<script lang="ts">
  import EnTete from '$lib/components/EnTete.svelte'
  import Vide from '$lib/components/Vide.svelte'
  import ErreurSection from '$lib/components/ErreurSection.svelte'
  import { longDate, timeOf } from '@ecole2recte/protocol'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  let filtre = $state<'tout' | 'absence' | 'late' | 'sanction' | 'encouragement'>('tout')

  const visibles = $derived(data.evenements.filter((entry) => filtre === 'tout' || entry.kind === filtre))

  const LIBELLES: Record<string, string> = {
    absence: 'Absence',
    late: 'Retard',
    sanction: 'Sanction',
    encouragement: 'Encouragement',
    other: 'Événement',
  }
</script>

<svelte:head><title>Vie scolaire — ecole2recte</title></svelte:head>

<EnTete
  surtitre="Vie scolaire"
  titre="Absences et retards"
  soustitre={`${data.compteurs.absences} absence${data.compteurs.absences > 1 ? 's' : ''} · ${data.compteurs.retards} retard${data.compteurs.retards > 1 ? 's' : ''}`}
/>

{#if data.compteurs.nonJustifiees > 0}
  <p class="erreur" style="margin-bottom:14px">
    {data.compteurs.nonJustifiees} absence{data.compteurs.nonJustifiees > 1 ? 's' : ''} non justifiée{data.compteurs.nonJustifiees > 1 ? 's' : ''}.
  </p>
{/if}

<div class="defilement" role="group" aria-label="Filtre" style="margin-bottom:14px">
  {#each [['tout', 'Tout'], ['absence', 'Absences'], ['late', 'Retards'], ['sanction', 'Sanctions'], ['encouragement', 'Encouragements']] as [valeur, libelle] (valeur)}
    <button class="pastille" aria-pressed={filtre === valeur} onclick={() => (filtre = valeur as typeof filtre)}>
      {libelle}
    </button>
  {/each}
</div>

{#if data.erreur}
  <ErreurSection message="La vie scolaire n’a pas pu être chargée." cause={data.erreur.message} />
{/if}

<div class="pile">
  {#each visibles as evenement (evenement.id)}
    <article class="carte">
      <div class="rangee" style="align-items:flex-start">
        <div style="flex:1;min-width:0">
          <p style="font-weight:600">{LIBELLES[evenement.kind] ?? evenement.label}</p>
          <p class="discret">
            {longDate(evenement.start)}{timeOf(evenement.start) ? ` · ${timeOf(evenement.start)}` : ''}
          </p>
          {#if evenement.reason}<p class="discret">Motif : {evenement.reason}</p>{/if}
          {#if evenement.comment}<p class="discret">{evenement.comment}</p>{/if}
        </div>
        <div style="text-align:right">
          <!-- La durée est celle que compte l'établissement, pas celle qu'on recalculerait. -->
          {#if evenement.duration}<p class="discret">{evenement.duration}</p>{/if}
          {#if evenement.kind === 'absence'}
            <p class={evenement.justified ? 'ok' : 'ko'}>{evenement.justified ? 'Justifiée' : 'Non justifiée'}</p>
          {/if}
        </div>
      </div>
    </article>
  {:else}
    <Vide titre="Rien à signaler" description="Aucun événement pour ce filtre." />
  {/each}
</div>

<style>
  .ok { color: var(--succes); font-size: 0.85rem; font-weight: 600; }
  .ko { color: var(--erreur); font-size: 0.85rem; font-weight: 600; }
</style>
