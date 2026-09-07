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
  const minutes = $derived(
    data.duJour
      .filter((cours) => !cours.canceled)
      .reduce((total, cours) => total + Math.round((Date.parse(`${cours.end}Z`) - Date.parse(`${cours.start}Z`)) / 60000), 0),
  )
</script>

<svelte:head><title>Emploi du temps — ecole2recte</title></svelte:head>

<EnTete
  surtitre={relativeDay(data.selection, data.jour)}
  titre="Emploi du temps"
  soustitre={mode === 'jour'
    ? `${data.duJour.filter((c) => !c.canceled).length} cours · ${duration(minutes)}`
    : `Semaine du ${shortDate(data.debutSemaine)}`}
/>

<div class="rangee" style="margin-bottom:14px;flex-wrap:wrap">
  <div class="defilement" role="group" aria-label="Vue">
    <button class="pastille" aria-pressed={mode === 'jour'} onclick={() => (mode = 'jour')}>Jour</button>
    <button class="pastille" aria-pressed={mode === 'semaine'} onclick={() => (mode = 'semaine')}>Semaine</button>
  </div>
  <span class="espace"></span>
  <!-- Les flèches suivent le mode : en vue « Jour » elles avancent d'un jour d'école, seul
       équivalent au balayage horizontal pour qui navigue au clavier ou au lecteur d'écran. -->
  <a
    class="pastille"
    href={`?jour=${mode === 'jour' ? previousSchoolDay(data.selection) : addDays(data.selection, -7)}`}
  >{mode === 'jour' ? 'Jour précédent' : 'Semaine précédente'}</a>
  <a class="pastille" href="/emploi-du-temps">Aujourd’hui</a>
  <a
    class="pastille"
    href={`?jour=${mode === 'jour' ? nextSchoolDay(data.selection) : addDays(data.selection, 7)}`}
  >{mode === 'jour' ? 'Jour suivant' : 'Semaine suivante'}</a>
</div>

{#if data.erreur}
  <ErreurSection message="L’emploi du temps n’a pas pu être chargé." cause={data.erreur.message} />
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
      {#each data.devoirsDuJour.filter((d) => d.subject === cours.subject) as devoir (devoir.id)}
        <p class="attache">À rendre : {devoir.content || devoir.subject}</p>
      {/each}
    {:else}
      <Vide titre="Pas de cours" description={`Rien n’est inscrit le ${longDate(data.selection)}.`} />
    {/each}

    {#if data.trous.length > 0}
      <h2 style="margin-top:18px">Trous</h2>
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
  .attache {
    margin-left: 18px;
    padding: 8px 12px;
    border-left: 3px solid var(--accent);
    background: var(--accent-doux);
    border-radius: 0 var(--rayon-petit) var(--rayon-petit) 0;
    font-size: 0.88rem;
  }
</style>
