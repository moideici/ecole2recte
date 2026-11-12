<script lang="ts">
  import EnTete from '$lib/components/EnTete.svelte'
  import Actualiser from '$lib/components/Actualiser.svelte'
  import Cours from '$lib/components/Cours.svelte'
  import GrilleSemaine from '$lib/components/GrilleSemaine.svelte'
  import Vide from '$lib/components/Vide.svelte'
  import ErreurSection from '$lib/components/ErreurSection.svelte'
  import { fusionnerCours, pauses, nomPause } from '$lib/emploiDuTemps.js'
  import {
    type Lesson,
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

  const actuel = $derived(currentLesson(data.duJour, data.maintenant))
  const minutesDuJour = $derived(
    data.duJour
      .filter((cours) => !cours.canceled)
      .reduce((total, cours) => total + (minutes(cours.end) - minutes(cours.start)), 0),
  )

  function minutes(instant: string): number {
    return Number(instant.slice(11, 13)) * 60 + Number(instant.slice(14, 16))
  }

  /** Ce qui est à rendre dans ce cours-là : c'est là qu'on le cherche. */
  function mention(date: string, cours: Lesson): string {
    const devoirs = data.devoirsSemaine.filter((devoir) => devoir.dueDate === date && devoir.subject === cours.subject)
    if (devoirs.some((devoir) => devoir.exam)) return 'Évaluation'
    return devoirs.length > 0 ? 'À rendre' : ''
  }

  /** Le lien qui garde la vue courante : changer de semaine ne doit pas changer d'écran. */
  function lien(jour: string): string {
    return `?jour=${jour}&vue=${data.vue}`
  }
</script>

<svelte:head><title>Emploi du temps — ecole2recte</title></svelte:head>

<EnTete
  surtitre={data.vue === 'semaine' ? `Semaine du ${shortDate(data.debutSemaine)}` : relativeDay(data.selection, data.jour)}
  titre="Emploi du temps"
  soustitre={data.vue === 'jour'
    ? `${data.duJour.filter((cours) => !cours.canceled).length} cours · ${duration(minutesDuJour)}`
    : `${data.semaine.reduce((total, jour) => total + jour.cours, 0)} cours`}
>
  {#snippet actions()}
    <div class="onglets sans-marge" role="group" aria-label="Vue">
      <a href={`?jour=${data.selection}&vue=semaine`} aria-current={data.vue === 'semaine'}>Semaine</a>
      <a href={`?jour=${data.selection}&vue=jour`} aria-current={data.vue === 'jour'}>Jour</a>
    </div>
    <Actualiser />
  {/snippet}
</EnTete>

<div class="rangee barre">
  <!-- Les flèches suivent la vue : en vue « Jour » elles avancent d'un jour d'école, seul
       équivalent au balayage horizontal pour qui navigue au clavier ou au lecteur d'écran. -->
  <a
    class="pastille"
    href={lien(data.vue === 'jour' ? previousSchoolDay(data.selection) : addDays(data.selection, -7))}
  >‹ {data.vue === 'jour' ? 'Jour précédent' : 'Semaine précédente'}</a>
  <a class="pastille" href={`?vue=${data.vue}`}>Aujourd’hui</a>
  <a
    class="pastille"
    href={lien(data.vue === 'jour' ? nextSchoolDay(data.selection) : addDays(data.selection, 7))}
  >{data.vue === 'jour' ? 'Jour suivant' : 'Semaine suivante'} ›</a>
</div>

{#if data.erreur}
  <ErreurSection message="L’emploi du temps n’a pas pu être chargé." cause={data.erreur.message} />
{/if}

{#if data.vue === 'semaine'}
  <section class="panneau">
    <GrilleSemaine
      jours={data.semaine}
      debut={data.grille.debut}
      fin={data.grille.fin}
      aujourdhui={data.jour}
      lien={(date) => `?jour=${date}&vue=jour`}
      lienCours={(date) => `/devoirs/${date}`}
      {mention}
    />
  </section>
{:else}
  <div class="pile">
    <div class="rangee" style="flex-wrap:wrap">
      <h2 class="titre-jour">{longDate(data.selection)}</h2>
      <span class="espace"></span>
      <a class="pastille" href={`/devoirs/${data.selection}`}>Travail et contenu des séances ›</a>
    </div>
    {#each fusionnerCours(data.duJour) as cours (cours.id)}
      {#each pauses(data.duJour).filter((pause) => pause.end === cours.start) as pause}
        <p class="carte discret">{nomPause(pause.start, pause.end)} · {timeOf(pause.start)} – {timeOf(pause.end)}</p>
      {/each}
      {#if data.selection === data.jour && cours.start <= data.maintenant && cours.end > data.maintenant}
        <p class="maintenant">Maintenant · {timeOf(data.maintenant)}</p>
      {/if}
      <!-- Un cours mène à sa journée : l'énoncé du travail et ce qui a été fait en classe. -->
      <Cours {cours} actuel={!!actuel && cours.start <= data.maintenant && cours.end > data.maintenant} href={`/devoirs/${data.selection}`} />
      {#each data.devoirsDuJour.filter((devoir) => devoir.subject === cours.subject) as devoir (devoir.id)}
        <a class="attache" href={`/devoirs/${data.selection}#${devoir.id}`}>
          À rendre : {devoir.content || devoir.subject}
        </a>
      {/each}
    {:else}
      <Vide titre="Pas de cours" description={`Rien n’est inscrit le ${longDate(data.selection)}.`} />
    {/each}


  </div>
{/if}

<style>
  .maintenant { border-top: 2px solid var(--erreur); color: var(--erreur); font-size: 0.85rem; }
  .sans-marge { border-bottom: 0; margin-bottom: 0; }
  .barre { flex-wrap: wrap; margin-bottom: 14px; }
  .titre-jour { margin-bottom: 4px; }

  .attache {
    display: block;
    margin-left: 18px;
    padding: 8px 12px;
    border-left: 3px solid var(--accent);
    background: var(--accent-doux);
    border-radius: 0 var(--rayon-petit) var(--rayon-petit) 0;
    font-size: 0.88rem;
    color: inherit;
    text-decoration: none;
  }
  .attache:hover { background: color-mix(in srgb, var(--accent-doux) 70%, var(--accent)); }
</style>
