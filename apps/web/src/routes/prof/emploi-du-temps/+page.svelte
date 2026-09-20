<script lang="ts">
  import EnTete from '$lib/components/EnTete.svelte'
  import Cours from '$lib/components/Cours.svelte'
  import Vide from '$lib/components/Vide.svelte'
  import ErreurSection from '$lib/components/ErreurSection.svelte'
  import {
    addDays,
    currentLesson,
    duration,
    longDate,
    minutesBetween,
    nextSchoolDay,
    previousSchoolDay,
    relativeDay,
    shortDate,
    timeOf,
  } from '@ecole2recte/protocol'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  let mode = $state<'jour' | 'semaine'>('jour')

  const actuel = $derived(currentLesson(data.duJour, data.maintenant))
  const tenus = $derived(data.duJour.filter((cours) => !cours.canceled))
  const minutes = $derived(tenus.reduce((total, cours) => total + minutesBetween(cours.start, cours.end), 0))
</script>

<svelte:head><title>Emploi du temps — ecole2recte</title></svelte:head>

<EnTete
  surtitre={relativeDay(data.selection, data.jour)}
  titre="Emploi du temps"
  soustitre={mode === 'jour' ? `${tenus.length} cours · ${duration(minutes)}` : `Semaine du ${shortDate(data.debutSemaine)}`}
/>

<div class="rangee" style="margin-bottom:14px;flex-wrap:wrap">
  <div class="defilement" role="group" aria-label="Vue">
    <button class="pastille" aria-pressed={mode === 'jour'} onclick={() => (mode = 'jour')}>Jour</button>
    <button class="pastille" aria-pressed={mode === 'semaine'} onclick={() => (mode = 'semaine')}>Semaine</button>
  </div>
  <span class="espace"></span>
  <a
    class="pastille"
    href={`?jour=${mode === 'jour' ? previousSchoolDay(data.selection) : addDays(data.selection, -7)}`}
  >{mode === 'jour' ? 'Jour précédent' : 'Semaine précédente'}</a>
  <a class="pastille" href="/prof/emploi-du-temps">Aujourd’hui</a>
  <a
    class="pastille"
    href={`?jour=${mode === 'jour' ? nextSchoolDay(data.selection) : addDays(data.selection, 7)}`}
  >{mode === 'jour' ? 'Jour suivant' : 'Semaine suivante'}</a>
</div>

{#if data.erreur}
  <ErreurSection message="L’emploi du temps n’a pas pu être chargé." cause={data.erreur} />
{/if}

{#if mode === 'semaine'}
  <div class="semaine">
    {#each data.semaine as jour (jour.date)}
      <a class="carte" href={`?jour=${jour.date}`} aria-current={jour.date === data.selection}>
        <p class="minuscule">{relativeDay(jour.date, data.jour)}</p>
        <p style="font-weight:600">{shortDate(jour.date)}</p>
        <p class="discret">{jour.cours === 0 ? 'Pas de cours' : `${jour.cours} cours · ${duration(jour.minutes)}`}</p>
      </a>
    {/each}
  </div>
{:else}
  <div class="pile">
    {#each data.duJour as cours (cours.id)}
      <Cours {cours} actuel={actuel?.id === cours.id} />
    {:else}
      <Vide titre="Pas de cours" description={`Rien n’est inscrit le ${longDate(data.selection)}.`} />
    {/each}

    {#if data.trous.length > 0}
      <h2 style="margin-top:18px">Heures libres</h2>
      {#each data.trous as trou (trou.start)}
        <p class="carte discret">{timeOf(trou.start)} – {timeOf(trou.end)} · {duration(trou.minutes)}</p>
      {/each}
    {/if}
  </div>
{/if}

<style>
  .semaine { display: grid; gap: 10px; grid-template-columns: 1fr; }
  @media (min-width: 700px) { .semaine { grid-template-columns: repeat(3, 1fr); } }
  .semaine a { text-decoration: none; }
  .semaine a[aria-current='true'] { border-color: var(--accent); }
</style>
