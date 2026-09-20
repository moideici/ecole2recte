<script lang="ts">
  import EnTete from '$lib/components/EnTete.svelte'
  import Actualiser from '$lib/components/Actualiser.svelte'
  import Cours from '$lib/components/Cours.svelte'
  import Vide from '$lib/components/Vide.svelte'
  import ErreurSection from '$lib/components/ErreurSection.svelte'
  import { longDate, relativeDay, relativeTime } from '@ecole2recte/protocol'
  import { couleurMatiere } from '$lib/matiereCouleur.js'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  const parent = $derived(data.profil?.parent ?? false)

  function arrondi(valeur: number | undefined): string {
    return valeur === undefined ? '—' : valeur.toFixed(2).replace('.', ',')
  }
</script>

<svelte:head><title>Accueil — ecole2recte</title></svelte:head>

<EnTete
  surtitre={longDate(data.jour)}
  titre={parent ? (data.profil?.nom ?? 'Accueil') : 'Bonjour'}
  soustitre={parent ? 'Vue parent' : (data.profil?.classe ?? '')}
>
  {#snippet actions()}<Actualiser />{/snippet}
</EnTete>

{#if data.erreurs.timetable}
  <ErreurSection message="L'emploi du temps n'a pas pu être chargé." cause={data.erreurs.timetable.message} />
{/if}

<!--
  Le bandeau de tête : ce qu'on veut savoir en trois secondes, et rien d'autre. Ce qui y
  figure a une page à soi, atteignable d'un clic.
-->
<div class="vignettes">
  <a class="vignette" href="/notes">
    <span class="minuscule">Moyenne générale</span>
    <span class="valeur nombre">{arrondi(data.moyenne.value)}</span>
    <span class="discret">
      {#if data.moyenne.origin === 'recomputed'}
        Recalculée · bulletin {arrondi(data.moyenne.official)}
      {:else if data.moyenne.origin === 'computed'}
        Calculée
      {:else if data.moyenne.origin === 'official'}
        {data.periode?.name ?? 'Bulletin'}
      {:else}
        Aucune note
      {/if}
    </span>
  </a>
  <a class="vignette" href="/devoirs">
    <span class="minuscule">À faire</span>
    <span class="valeur nombre">{data.aFaire.length}</span>
    <span class="discret">{data.evaluations.length} évaluation{data.evaluations.length > 1 ? 's' : ''} à venir</span>
  </a>
  <a class="vignette" href="/messages">
    <span class="minuscule">Messages</span>
    <span class="valeur nombre">{data.nonLusTotal}</span>
    <span class="discret">non lu{data.nonLusTotal > 1 ? 's' : ''}</span>
  </a>
  <a class="vignette" class:alerte={data.absences > 0} href="/vie-scolaire">
    <span class="minuscule">Vie scolaire</span>
    <span class="valeur nombre">{data.absences}</span>
    <span class="discret">absence{data.absences > 1 ? 's' : ''} non justifiée{data.absences > 1 ? 's' : ''}</span>
  </a>
</div>

<div class="grille">
  <section class="panneau" aria-labelledby="t-cours">
    <div class="tete-panneau">
      <h2 id="t-cours">{data.enCours ? 'En ce moment' : 'Prochain cours'}</h2>
    </div>
    <div class="corps-panneau pile">
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
    </div>
  </section>

  <section class="panneau" aria-labelledby="t-journee">
    <div class="tete-panneau">
      <h2 id="t-journee">
        {data.prochaineJournee ? `Prochaine journée · ${relativeDay(data.prochaineJournee, data.jour)}` : 'Aujourd’hui'}
      </h2>
    </div>
    <div class="corps-panneau pile">
      {#each (data.prochaineJournee ? data.prochainsCours : data.duJour).slice(0, 5) as cours (cours.id)}
        <Cours {cours} />
      {:else}
        <Vide titre="Pas de cours" description="Rien n’est inscrit à l’emploi du temps." />
      {/each}
      <a class="bouton" href="/emploi-du-temps">Voir l’emploi du temps</a>
    </div>
  </section>

  <section class="panneau" aria-labelledby="t-devoirs">
    <div class="tete-panneau">
      <h2 id="t-devoirs">À faire</h2>
      <span class="espace"></span>
      <a class="discret" href="/devoirs">Tout voir</a>
    </div>
    <div class="corps-panneau serre">
      {#each data.aFaire as devoir (devoir.id)}
        {@const couleur = couleurMatiere(devoir.subject)}
        <!-- Cliquer ouvre la journée sur ce devoir : énoncé complet, pièces jointes, séance. -->
        <a
          class="ligne"
          href={`/devoirs/${devoir.dueDate}#${devoir.id}`}
          style={`--fond-matiere:${couleur.fond};--encre-matiere:${couleur.encre}`}
        >
          <span class="filet" aria-hidden="true"></span>
          <span class="ligne-texte">
            <span class="rangee" style="gap:6px">
              <span class="etiquette-matiere">{devoir.subject}</span>
              <span class="discret">{relativeDay(devoir.dueDate, data.jour)}</span>
              {#if devoir.exam}<span class="jeton alerte">Évaluation</span>{/if}
            </span>
            {#if devoir.content}
              <span class="extrait">{devoir.content}</span>
            {:else}
              <span class="discret">Aucun énoncé saisi.</span>
            {/if}
          </span>
          <span class="chevron" aria-hidden="true">›</span>
        </a>
      {:else}
        <div style="padding:14px"><Vide titre="Rien à faire" description="Tous les devoirs connus sont cochés." /></div>
      {/each}
    </div>
  </section>

  {#if data.evaluations.length > 0}
    <section class="panneau" aria-labelledby="t-eval">
      <div class="tete-panneau"><h2 id="t-eval">Évaluations annoncées</h2></div>
      <div class="corps-panneau serre">
        {#each data.evaluations as devoir (devoir.id)}
          {@const couleur = couleurMatiere(devoir.subject)}
          <a
            class="ligne"
            href={`/devoirs/${devoir.dueDate}#${devoir.id}`}
            style={`--fond-matiere:${couleur.fond};--encre-matiere:${couleur.encre}`}
          >
            <span class="filet" aria-hidden="true"></span>
            <span class="ligne-texte">
              <span class="rangee" style="gap:6px">
                <span class="etiquette-matiere">{devoir.subject}</span>
                <span class="discret">{relativeDay(devoir.dueDate, data.jour)}</span>
              </span>
            </span>
            <span class="chevron" aria-hidden="true">›</span>
          </a>
        {/each}
      </div>
    </section>
  {/if}

  <section class="panneau" aria-labelledby="t-notes">
    <div class="tete-panneau">
      <h2 id="t-notes">Dernières notes</h2>
      <span class="espace"></span>
      <a class="discret" href="/notes">Tout voir</a>
    </div>
    <div class="corps-panneau serre">
      {#each data.dernieresNotes as note (note.id)}
        {@const couleur = couleurMatiere(note.subject)}
        <a
          class="ligne"
          href={`/notes#note-${note.id}`}
          style={`--fond-matiere:${couleur.fond};--encre-matiere:${couleur.encre}`}
        >
          <span class="filet" aria-hidden="true"></span>
          <span class="ligne-texte">
            <span class="etiquette-matiere">{note.subject}</span>
            <span class="discret">{note.label || 'Évaluation'}</span>
          </span>
          <span class="note-valeur nombre">
            {note.value !== undefined ? String(note.value).replace('.', ',') : '—'}<span class="sur">/{note.scale}</span>
          </span>
        </a>
      {:else}
        <div style="padding:14px"><Vide titre="Aucune note" description="Rien n’a encore été saisi." /></div>
      {/each}
    </div>
  </section>

  <section class="panneau" aria-labelledby="t-messages">
    <div class="tete-panneau">
      <h2 id="t-messages">Messages</h2>
      <span class="espace"></span>
      <a class="discret" href="/messages">Tout voir</a>
    </div>
    <div class="corps-panneau serre">
      {#each data.nonLus as message (message.id)}
        <a class="ligne" href={`/messages/${message.id}`}>
          <span class="filet accent" aria-hidden="true"></span>
          <span class="ligne-texte">
            <span style="font-weight:600">{message.sender}</span>
            <span class="discret">{message.subject}</span>
          </span>
        </a>
      {:else}
        <div style="padding:14px"><Vide titre="Tout est lu" /></div>
      {/each}
    </div>
  </section>

  {#each data.actualites as actualite (actualite.id)}
    <section class="panneau" aria-labelledby={`t-${actualite.id}`}>
      <div class="tete-panneau"><h2 id={`t-${actualite.id}`}>Actualité</h2></div>
      <div class="corps-panneau">
        <a href="/actualites" style="font-weight:600;text-decoration:none;color:inherit">{actualite.title}</a>
        {#if actualite.date}<p class="discret">{longDate(actualite.date)}</p>{/if}
        {#if actualite.content}<p class="extrait" style="margin-top:6px">{actualite.content}</p>{/if}
      </div>
    </section>
  {/each}
</div>

<style>
  .vignettes { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-bottom: 20px; }
  @media (min-width: 900px) { .vignettes { grid-template-columns: repeat(4, minmax(0, 1fr)); } }

  .vignette {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px 14px;
    background: var(--surface);
    border: 1px solid var(--bordure);
    border-top: 3px solid var(--accent);
    border-radius: var(--rayon);
    box-shadow: var(--ombre);
    text-decoration: none;
    color: inherit;
  }
  .vignette:hover { border-color: var(--accent); }
  .vignette.alerte { border-top-color: var(--erreur); }
  .vignette .valeur { font-size: 1.8rem; font-weight: 700; line-height: 1.1; }
  .vignette .discret { font-size: 0.8rem; }

  .grille { display: grid; gap: 18px; grid-template-columns: 1fr; align-items: start; }
  @media (min-width: 760px) { .grille { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (min-width: 1280px) { .grille { grid-template-columns: repeat(3, minmax(0, 1fr)); } }

  .ligne {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 14px 9px 0;
    border-bottom: 1px solid var(--bordure-douce);
    text-decoration: none;
    color: inherit;
  }
  .ligne:last-child { border-bottom: 0; }
  .ligne:hover { background: var(--surface-2); }
  .filet { width: 5px; align-self: stretch; min-height: 34px; background: var(--encre-matiere); border-radius: 0 3px 3px 0; flex: none; }
  .filet.accent { background: var(--accent); }
  .ligne-texte { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; align-items: flex-start; }
  .note-valeur { font-weight: 700; font-size: 1.15rem; }
  .sur { font-size: 0.7em; color: var(--encre-douce); }
  .chevron { color: var(--encre-douce); font-size: 1.3rem; flex: none; }

  .extrait {
    color: var(--encre-douce);
    font-size: 0.86rem;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .jauge { height: 6px; background: var(--surface-2); border-radius: 999px; overflow: hidden; }
  .jauge span { display: block; height: 100%; background: var(--accent); }
</style>
