<script lang="ts">
  import EnTete from '$lib/components/EnTete.svelte'
  import Cours from '$lib/components/Cours.svelte'
  import Vide from '$lib/components/Vide.svelte'
  import ErreurSection from '$lib/components/ErreurSection.svelte'
  import { longDate, relativeDay, relativeTime, timeOf } from '@ecole2recte/protocol'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  const parent = $derived(data.profil?.parent ?? false)
</script>

<svelte:head><title>Accueil — ecole2recte</title></svelte:head>

<EnTete
  surtitre={longDate(data.jour)}
  titre={parent ? (data.profil?.nom ?? 'Accueil') : 'Bonjour'}
  soustitre={parent ? 'Vue parent' : (data.profil?.classe ?? '')}
/>

{#if data.erreurs.timetable}
  <ErreurSection message="L'emploi du temps n'a pas pu être chargé." cause={data.erreurs.timetable.message} />
{/if}

<div class="grille">
  <section class="pile" aria-labelledby="t-cours">
    <h2 id="t-cours">{data.enCours ? 'En ce moment' : 'Prochain cours'}</h2>
    {#if data.enCours}
      <Cours cours={data.enCours} actuel />
      {#if data.avancement !== undefined}
        <div class="jauge" role="img" aria-label={`Journée avancée à ${Math.round(data.avancement * 100)} %`}>
          <span style={`width:${Math.round(data.avancement * 100)}%`}></span>
        </div>
      {/if}
    {:else if data.suivant}
      <Cours cours={data.suivant} />
      <p class="discret">{relativeTime(data.suivant.start, data.maintenant)}</p>
    {:else}
      <Vide titre="Plus de cours" description="La journée est finie." />
    {/if}
  </section>

  <section class="pile" aria-labelledby="t-journee">
    <h2 id="t-journee">
      {data.prochaineJournee ? `Prochaine journée · ${relativeDay(data.prochaineJournee, data.jour)}` : 'Aujourd’hui'}
    </h2>
    {#each (data.prochaineJournee ? data.prochainsCours : data.duJour).slice(0, 5) as cours (cours.id)}
      <Cours {cours} />
    {:else}
      <Vide titre="Pas de cours" description="Rien n’est inscrit à l’emploi du temps." />
    {/each}
    <a class="bouton" href="/emploi-du-temps">Voir l’emploi du temps</a>
  </section>

  <section class="pile" aria-labelledby="t-devoirs">
    <h2 id="t-devoirs">À faire</h2>
    {#each data.aFaire as devoir (devoir.id)}
      <a class="carte" href={`/devoirs#${devoir.id}`}>
        <p style="font-weight:600">{devoir.subject}</p>
        <p class="discret">{relativeDay(devoir.dueDate, data.jour)}</p>
        {#if devoir.content}<p class="extrait">{devoir.content}</p>{/if}
      </a>
    {:else}
      <Vide titre="Rien à faire" description="Tous les devoirs connus sont cochés." />
    {/each}
  </section>

  {#if data.evaluations.length > 0}
    <section class="pile" aria-labelledby="t-eval">
      <h2 id="t-eval">Évaluations</h2>
      {#each data.evaluations as devoir (devoir.id)}
        <div class="carte">
          <p style="font-weight:600">{devoir.subject}</p>
          <p class="discret">{relativeDay(devoir.dueDate, data.jour)}</p>
        </div>
      {/each}
    </section>
  {/if}

  <section class="pile" aria-labelledby="t-notes">
    <h2 id="t-notes">Dernières notes</h2>
    {#each data.dernieresNotes as note (note.id)}
      <div class="carte rangee">
        <div style="flex:1;min-width:0">
          <p style="font-weight:600">{note.subject}</p>
          <p class="discret">{note.label || 'Évaluation'}</p>
        </div>
        <p class="valeur">
          {note.value !== undefined ? `${note.value}` : '—'}<span class="discret">/{note.scale}</span>
        </p>
      </div>
    {:else}
      <Vide titre="Aucune note" description="Rien n’a encore été saisi." />
    {/each}
    <a class="bouton" href="/notes">Voir les notes</a>
  </section>

  <section class="pile" aria-labelledby="t-messages">
    <h2 id="t-messages">Messages</h2>
    {#if data.nonLusTotal === 0}
      <Vide titre="Tout est lu" />
    {:else}
      {#each data.nonLus as message (message.id)}
        <a class="carte" href={`/messages/${message.id}`}>
          <p style="font-weight:600">{message.sender}</p>
          <p class="discret">{message.subject}</p>
        </a>
      {/each}
      <a class="bouton" href="/messages">{data.nonLusTotal} non lu{data.nonLusTotal > 1 ? 's' : ''}</a>
    {/if}
  </section>

  {#if data.absences > 0}
    <section class="pile" aria-labelledby="t-vs">
      <h2 id="t-vs">Vie scolaire</h2>
      <a class="carte" href="/vie-scolaire">
        <p style="font-weight:600">
          {data.absences} absence{data.absences > 1 ? 's' : ''} non justifiée{data.absences > 1 ? 's' : ''}
        </p>
      </a>
    </section>
  {/if}

  {#each data.actualites as actualite (actualite.id)}
    <section class="pile" aria-labelledby={`t-${actualite.id}`}>
      <h2 id={`t-${actualite.id}`}>Actualité</h2>
      <a class="carte" href="/actualites">
        <p style="font-weight:600">{actualite.title}</p>
        {#if actualite.date}<p class="discret">{longDate(actualite.date)}</p>{/if}
      </a>
    </section>
  {/each}
</div>

<style>
  .grille { display: grid; gap: 22px; grid-template-columns: 1fr; }
  @media (min-width: 700px) { .grille { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (min-width: 1200px) { .grille { grid-template-columns: repeat(3, minmax(0, 1fr)); } }

  .valeur { font-weight: 700; font-size: 1.25rem; font-variant-numeric: tabular-nums; }
  .extrait {
    color: var(--encre-douce);
    font-size: 0.88rem;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin-top: 4px;
  }
  .jauge { height: 6px; background: var(--surface-2); border-radius: 999px; overflow: hidden; }
  .jauge span { display: block; height: 100%; background: var(--accent); }
</style>
