<script lang="ts">
  import EnTete from '$lib/components/EnTete.svelte'
  import Cours from '$lib/components/Cours.svelte'
  import GrilleSemaine from '$lib/components/GrilleSemaine.svelte'
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

  const actuel = $derived(currentLesson(data.duJour, data.maintenant))
  const tenus = $derived(data.duJour.filter((cours) => !cours.canceled))
  const minutes = $derived(tenus.reduce((total, cours) => total + minutesBetween(cours.start, cours.end), 0))

  function lien(jour: string): string {
    return `?jour=${jour}&vue=${data.vue}`
  }
</script>

<svelte:head><title>Emploi du temps — ecole2recte</title></svelte:head>

<EnTete
  surtitre={data.vue === 'semaine' ? `Semaine du ${shortDate(data.debutSemaine)}` : relativeDay(data.selection, data.jour)}
  titre="Emploi du temps"
  soustitre={data.vue === 'jour'
    ? `${tenus.length} cours · ${duration(minutes)}`
    : `${data.semaine.reduce((total, jour) => total + jour.cours, 0)} cours`}
>
  {#snippet actions()}
    <div class="onglets sans-marge" role="group" aria-label="Vue">
      <a href={`?jour=${data.selection}&vue=semaine`} aria-current={data.vue === 'semaine'}>Semaine</a>
      <a href={`?jour=${data.selection}&vue=jour`} aria-current={data.vue === 'jour'}>Jour</a>
    </div>
  {/snippet}
</EnTete>

<div class="rangee barre">
  <a
    class="pastille"
    href={lien(data.vue === 'jour' ? previousSchoolDay(data.selection) : addDays(data.selection, -7))}
  >‹ {data.vue === 'jour' ? 'Jour précédent' : 'Semaine précédente'}</a>
  <a class="pastille" href={`/prof/emploi-du-temps?vue=${data.vue}`}>Aujourd’hui</a>
  <a
    class="pastille"
    href={lien(data.vue === 'jour' ? nextSchoolDay(data.selection) : addDays(data.selection, 7))}
  >{data.vue === 'jour' ? 'Jour suivant' : 'Semaine suivante'} ›</a>
</div>

{#if data.erreur}
  <ErreurSection message="L’emploi du temps n’a pas pu être chargé." cause={data.erreur} />
{/if}

{#if data.vue === 'semaine'}
  <section class="panneau">
    <!--
      Côté professeur, ce qui distingue deux heures n'est pas la matière — il n'en a souvent
      qu'une — mais la classe : c'est elle qui titre le bloc et lui donne sa couleur.
    -->
    <GrilleSemaine
      jours={data.semaine}
      debut={data.grille.debut}
      fin={data.grille.fin}
      aujourdhui={data.jour}
      lien={(date) => `?jour=${date}&vue=jour`}
      titre={(cours) => cours.group || cours.subject}
      teinte={(cours) => cours.group || cours.subject}
    />
  </section>
{:else}
  <div class="pile">
    <h2 style="margin-bottom:4px">{longDate(data.selection)}</h2>
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
  .sans-marge { border-bottom: 0; margin-bottom: 0; }
  .barre { flex-wrap: wrap; margin-bottom: 14px; }
</style>
