<script lang="ts">
  import EnTete from '$lib/components/EnTete.svelte'
  import Vide from '$lib/components/Vide.svelte'
  import ErreurSection from '$lib/components/ErreurSection.svelte'
  import { addDays, longDate, shortDate, timeOf } from '@ecole2recte/protocol'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()

  /** La semaine et le filtre vivent dans l'adresse : une vue du cahier se partage telle quelle. */
  function lien(semaine: string, groupe: string): string {
    const params = new URLSearchParams()
    if (semaine !== data.semaineCourante) params.set('semaine', semaine)
    if (groupe !== '') params.set('groupe', groupe)
    const query = params.toString()
    return query === '' ? '/prof/cahier-de-textes' : `/prof/cahier-de-textes?${query}`
  }
</script>

<svelte:head><title>Cahier de textes — ecole2recte</title></svelte:head>

<EnTete
  surtitre="Cahier de textes"
  titre={`Semaine du ${shortDate(data.debut)}`}
  soustitre={data.total === 0 ? 'Aucune séance' : `${data.total} séance${data.total > 1 ? 's' : ''}`}
/>

<div class="rangee" style="flex-wrap:wrap;margin-bottom:12px">
  <a class="pastille" href={lien(addDays(data.debut, -7), data.groupe)}>Semaine précédente</a>
  <a class="pastille" href={lien(data.semaineCourante, data.groupe)}>Cette semaine</a>
  <a class="pastille" href={lien(addDays(data.debut, 7), data.groupe)}>Semaine suivante</a>
</div>

{#if data.groupes.length > 1 || data.groupe !== ''}
  <div class="defilement" role="group" aria-label="Classe" style="margin-bottom:14px">
    <a class="pastille" href={lien(data.debut, '')} aria-current={data.groupe === ''}>Toutes</a>
    {#each data.groupes as groupe (groupe.cle)}
      <a class="pastille" href={lien(data.debut, groupe.cle)} aria-current={data.groupe === groupe.cle}>{groupe.libelle}</a>
    {/each}
  </div>
{/if}

{#if data.erreur}
  <ErreurSection message="Le cahier de textes n’a pas pu être chargé." cause={data.erreur} />
{/if}

{#each data.jours as jour (jour.date)}
  <h2 class="jour">{jour.date === data.jour ? 'Aujourd’hui · ' : ''}{longDate(jour.date)}</h2>
  <div class="pile">
    {#each jour.seances as seance (seance.id)}
      <article class="carte pile" style="gap:8px">
        <div class="rangee" style="align-items:baseline;flex-wrap:wrap">
          <p class="heure">{timeOf(seance.start)} – {timeOf(seance.end)}</p>
          <p style="font-weight:600;flex:1">{seance.group.label}</p>
          {#if seance.exam}<span class="marque">Évaluation</span>{/if}
        </div>
        {#if seance.subject || seance.room}
          <p class="discret">{[seance.subject, seance.room].filter(Boolean).join(' · ')}</p>
        {/if}

        {#if seance.session}
          <div class="bloc">
            <p class="minuscule">Séance</p>
            <p class="texte">{seance.session.content}</p>
            {#each seance.session.attachments as piece (piece.id)}<p class="piece">{piece.name}</p>{/each}
          </div>
        {/if}

        {#if seance.homework}
          <div class="bloc afaire">
            <p class="minuscule">
              Travail à faire{seance.homework.givenOn ? ` · donné le ${shortDate(seance.homework.givenOn)}` : ''}
            </p>
            <p class="texte">{seance.homework.content}</p>
            {#if seance.homework.onlineSubmission}<p class="discret">À rendre en ligne</p>{/if}
            {#each seance.homework.attachments as piece (piece.id)}<p class="piece">{piece.name}</p>{/each}
          </div>
        {/if}

        {#if !seance.session && !seance.homework}
          <p class="discret">Rien n’est inscrit pour cette séance.</p>
        {/if}
      </article>
    {/each}
  </div>
{:else}
  {#if !data.erreur}
    <Vide titre="Aucune séance" description="Rien n’est inscrit au cahier de textes cette semaine." />
  {/if}
{/each}

<style>
  .jour { margin: 18px 0 10px; }
  .heure { font-variant-numeric: tabular-nums; font-weight: 600; min-width: 7.5rem; }
  .marque { font-size: 0.78rem; font-weight: 650; color: var(--alerte); }
  .bloc {
    border-left: 3px solid var(--bordure);
    padding: 4px 0 4px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .bloc.afaire { border-left-color: var(--accent); }
  .texte { white-space: pre-wrap; line-height: 1.55; }
  .piece { font-size: 0.88rem; color: var(--encre-douce); }
  .piece::before { content: '📎 '; }
</style>
