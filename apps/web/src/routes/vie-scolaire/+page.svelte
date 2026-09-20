<script lang="ts">
  import EnTete from '$lib/components/EnTete.svelte'
  import Actualiser from '$lib/components/Actualiser.svelte'
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

  /**
   * L'heure, quand il y en a une.
   *
   * Un encouragement n'a pas d'heure : la réponse du service est alors une date nue, que
   * `timeOf` rend « 00:00 ». L'afficher ferait croire à un événement survenu à minuit.
   */
  function heure(instant: string): string {
    const lu = timeOf(instant)
    return lu === '00:00' ? '' : lu
  }

  const FILTRES: Array<[typeof filtre, string]> = [
    ['tout', 'Tout'],
    ['absence', 'Absences'],
    ['late', 'Retards'],
    ['sanction', 'Sanctions'],
    ['encouragement', 'Encouragements'],
  ]
</script>

<svelte:head><title>Vie scolaire — ecole2recte</title></svelte:head>

<EnTete
  surtitre="Vie scolaire"
  titre="Absences et retards"
  soustitre={`${data.compteurs.absences} absence${data.compteurs.absences > 1 ? 's' : ''} · ${data.compteurs.retards} retard${data.compteurs.retards > 1 ? 's' : ''}`}
>
  {#snippet actions()}<Actualiser />{/snippet}
</EnTete>

{#if data.compteurs.nonJustifiees > 0}
  <p class="erreur" style="margin-bottom:14px">
    {data.compteurs.nonJustifiees} absence{data.compteurs.nonJustifiees > 1 ? 's' : ''} non justifiée{data.compteurs.nonJustifiees > 1 ? 's' : ''}.
  </p>
{/if}

<div class="onglets" role="group" aria-label="Filtre">
  {#each FILTRES as [valeur, libelle] (valeur)}
    <button aria-pressed={filtre === valeur} onclick={() => (filtre = valeur)}>{libelle}</button>
  {/each}
</div>

{#if data.erreur}
  <ErreurSection message="La vie scolaire n’a pas pu être chargée." cause={data.erreur.message} />
{/if}

<section class="panneau">
  <div class="corps-panneau serre">
    {#each visibles as evenement (evenement.id)}
      <article class="evenement" class:injustifiee={evenement.kind === 'absence' && !evenement.justified}>
        <span class="filet" aria-hidden="true"></span>
        <div class="texte">
          <p style="font-weight:650">{LIBELLES[evenement.kind] ?? evenement.label}</p>
          <p class="discret">
            {longDate(evenement.start)}{heure(evenement.start) ? ` · ${heure(evenement.start)}` : ''}
          </p>
          {#if evenement.reason}<p class="discret">Motif : {evenement.reason}</p>{/if}
          {#if evenement.comment}<p class="discret">{evenement.comment}</p>{/if}
        </div>
        <div class="etat">
          <!-- La durée est celle que compte l'établissement, pas celle qu'on recalculerait. -->
          {#if evenement.duration}<p class="discret nombre">{evenement.duration}</p>{/if}
          {#if evenement.kind === 'absence'}
            <span class={evenement.justified ? 'jeton succes' : 'jeton erreur-jeton'}>
              {evenement.justified ? 'Justifiée' : 'Non justifiée'}
            </span>
          {/if}
        </div>
      </article>
    {:else}
      <div style="padding:14px">
        <Vide titre="Rien à signaler" description="Aucun événement pour ce filtre." />
      </div>
    {/each}
  </div>
</section>

<style>
  .evenement {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 11px 14px 11px 0;
    border-bottom: 1px solid var(--bordure-douce);
  }
  .evenement:last-child { border-bottom: 0; }
  .filet { width: 5px; align-self: stretch; min-height: 40px; background: var(--encre-douce); border-radius: 0 3px 3px 0; flex: none; }
  .injustifiee .filet { background: var(--erreur); }
  .texte { flex: 1; min-width: 0; }
  .etat { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
</style>
