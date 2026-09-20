<script lang="ts">
  import EnTete from '$lib/components/EnTete.svelte'
  import Actualiser from '$lib/components/Actualiser.svelte'
  import Vide from '$lib/components/Vide.svelte'
  import ErreurSection from '$lib/components/ErreurSection.svelte'
  import { longDate, shortDate } from '@ecole2recte/protocol'
  import { couleurMatiere } from '$lib/matiereCouleur.js'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()

  /** Le relevé par matière, ou la chronologie : deux questions, deux lectures. */
  let vue = $state<'releve' | 'dernieres'>('releve')

  function arrondi(valeur: number | undefined | null): string {
    return valeur === undefined || valeur === null ? '—' : valeur.toFixed(2).replace('.', ',')
  }

  function brut(valeur: number | undefined): string {
    return valeur === undefined ? '—' : String(valeur).replace('.', ',')
  }

  /** La place d'une moyenne sur l'échelle de la classe, en pourcentage. */
  function position(valeur: number, min: number, max: number): number {
    if (max <= min) return 50
    return Math.min(100, Math.max(0, ((valeur - min) / (max - min)) * 100))
  }

  const tonalite = $derived(couleurMatiere(data.matiere))
</script>

<svelte:head><title>Notes — ecole2recte</title></svelte:head>

<EnTete surtitre="Relevé de notes" titre="Notes" soustitre={data.periode?.name ?? ''}
>
  {#snippet actions()}<Actualiser />{/snippet}
</EnTete>

{#if data.periodes.length > 1}
  <div class="onglets" role="group" aria-label="Période">
    {#each data.periodes as periode (periode.code)}
      <a href={`?periode=${periode.code}`} aria-current={periode.code === data.periode?.code}>{periode.name}</a>
    {/each}
  </div>
{/if}

{#if data.erreur}
  <ErreurSection message="Les notes n’ont pas pu être chargées." cause={data.erreur.message} />
{/if}

<!--
  La moyenne générale en tête, comme sur un bulletin : c'est le chiffre qu'on vient chercher.
  Ce qui suit dit d'où il vient — du bulletin, ou de notre calcul, et pourquoi.
-->
<section class="panneau generale" aria-labelledby="t-generale">
  <div class="tete-panneau">
    <h2 id="t-generale">Moyenne générale</h2>
    <span class="espace"></span>
    {#if data.generale.origin === 'recomputed'}
      <span class="jeton accent">Recalculée</span>
    {:else if data.generale.origin === 'computed'}
      <span class="jeton">Calculée</span>
    {:else if data.generale.origin === 'official'}
      <span class="jeton succes">Bulletin</span>
    {/if}
  </div>

  <div class="corps-panneau">
    <div class="chiffres">
      <p class="grande nombre">
        {arrondi(data.generale.value)}<span class="sur">/20</span>
      </p>
      <dl class="reperes">
        <div><dt>Classe</dt><dd class="nombre">{arrondi(data.periode?.classAverage)}</dd></div>
        <div><dt>Mini</dt><dd class="nombre">{arrondi(data.periode?.minimum)}</dd></div>
        <div><dt>Maxi</dt><dd class="nombre">{arrondi(data.periode?.maximum)}</dd></div>
      </dl>
    </div>

    {#if data.generale.origin === 'recomputed'}
      <!--
        Le point de la demande : la moyenne publiée est celle d'avant la dernière note. La
        montrer reviendrait à cacher cette note ; on montre la nôtre, et on dit exactement
        laquelle manquait pour que le chiffre reste vérifiable.
      -->
      <p class="explication">
        L’établissement publie <strong class="nombre">{arrondi(data.generale.official)}</strong>, calculée
        avant {data.generale.behind.length > 1
          ? `les ${data.generale.behind.length} dernières notes`
          : 'la dernière note'} :
        {#each data.generale.behind.slice(0, 3) as note, index (note.id)}
          <!-- Le lien bascule sur la chronologie : la note visée dormirait sinon dans une
               matière repliée, et cliquer ne montrerait rien. -->
          {index > 0 ? ', ' : ''}<a href={`#note-${note.id}`} onclick={() => (vue = 'dernieres')}
            >{note.subject}{note.value !== undefined ? ` ${brut(note.value)}/${note.scale}` : ''}{note.date
              ? ` du ${shortDate(note.date)}`
              : ''}</a
          >{/each}{data.generale.behind.length > 3 ? '…' : ''} — la moyenne affichée ici est la
        nôtre, notes et coefficients connus compris. Celle du bulletin reprendra la main dès
        qu’elle aura rattrapé.
      </p>
    {:else if data.generale.origin === 'computed'}
      <p class="explication">
        L’établissement ne publie pas de moyenne générale : celle-ci est calculée à partir des
        moyennes de matières, pondérées par leur coefficient. Elle peut différer du bulletin.
      </p>
    {/if}
  </div>
</section>

{#if data.periode?.appreciation}
  <section class="panneau" style="margin-top:18px">
    <div class="tete-panneau"><h2>Conseil de classe</h2></div>
    <div class="corps-panneau">
      <p>{data.periode.appreciation}</p>
      <p class="discret" style="margin-top:6px">
        {[data.periode.headTeacher, data.periode.councilDate ? longDate(data.periode.councilDate) : '']
          .filter(Boolean)
          .join(' · ')}
      </p>
    </div>
  </section>
{/if}

<!--
  Deux façons de lire les mêmes notes, parce qu'on vient chercher deux choses différentes :
  « où j'en suis dans cette matière » (le relevé), et « qu'est-ce qui vient de tomber »
  (les dernières). N'offrir que la première oblige à ouvrir huit matières pour le savoir.
-->
<div class="onglets" style="margin-top:18px" role="group" aria-label="Affichage">
  <button aria-pressed={vue === 'releve'} onclick={() => (vue = 'releve')}>Par matière</button>
  <button aria-pressed={vue === 'dernieres'} onclick={() => (vue = 'dernieres')}>Dernières notes</button>
</div>

{#if vue === 'dernieres'}
  <section class="panneau" aria-labelledby="t-dernieres">
    <div class="tete-panneau">
      <h2 id="t-dernieres">Dernières notes</h2>
      <span class="espace"></span>
      <span class="discret">{data.notes.length} note{data.notes.length > 1 ? 's' : ''}</span>
    </div>
    <div class="corps-panneau serre">
      {#each data.notes as note (note.id)}
        {@const couleur = couleurMatiere(note.subject)}
        <article
          class="note recente"
          id={`note-${note.id}`}
          style={`--fond-matiere:${couleur.fond};--encre-matiere:${couleur.encre}`}
        >
          <span class="filet" aria-hidden="true"></span>
          <div class="note-texte">
            <span class="etiquette-matiere">{note.subject}</span>
            <p class="note-titre">{note.label || 'Évaluation'}</p>
            <p class="discret">
              {[note.kind, note.date ? longDate(note.date) : '', `coef. ${note.coefficient}`].filter(Boolean).join(' · ')}
            </p>
            {#if !note.counted}<p class="jeton alerte">Ne compte pas dans la moyenne</p>{/if}
            {#if note.comment}<p class="discret" style="margin-top:4px">{note.comment}</p>{/if}
          </div>
          <div class="note-valeur">
            <p class="valeur nombre">{brut(note.value)}<span class="sur">/{note.scale}</span></p>
            {#if note.classAverage !== undefined}
              <p class="discret nombre">classe {arrondi(note.classAverage)}</p>
            {/if}
          </div>
        </article>
      {:else}
        <div style="padding:14px">
          <Vide titre="Aucune note" description="Rien n’a encore été saisi pour cette période." />
        </div>
      {/each}
    </div>
  </section>
{:else}
<section class="panneau" aria-labelledby="t-releve">
  <div class="tete-panneau">
    <h2 id="t-releve">Par matière</h2>
    <span class="espace"></span>
    <span class="discret">{data.notes.length} note{data.notes.length > 1 ? 's' : ''}</span>
  </div>
  <div class="corps-panneau serre">
    {#each data.matieres as matiere (matiere.subject)}
      {@const couleur = couleurMatiere(matiere.subject)}
      <details class="matiere" style={`--fond-matiere:${couleur.fond};--encre-matiere:${couleur.encre}`}>
        <summary>
          <span class="filet" aria-hidden="true"></span>
          <span class="nom">
            <span class="libelle">{matiere.subject}</span>
            <span class="discret detail">
              {[matiere.teacher, matiere.coefficient !== undefined ? `coef. ${matiere.coefficient}` : '']
                .filter(Boolean)
                .join(' · ')}
            </span>
            {#if matiere.verdict.origin === 'recomputed'}
              <span class="jeton accent">Recalculée · bulletin {arrondi(matiere.verdict.official)}</span>
            {:else if matiere.verdict.origin === 'computed'}
              <span class="jeton">Calculée</span>
            {/if}
          </span>
          <span class="moyenne nombre">{arrondi(matiere.verdict.value)}</span>
          <span class="classe nombre discret">{arrondi(matiere.classAverage)}</span>
        </summary>

        <div class="detail-matiere">
          {#if matiere.minimum !== undefined && matiere.maximum !== undefined && matiere.verdict.value !== undefined}
            <div
              class="echelle"
              role="img"
              aria-label={`Moyenne ${arrondi(matiere.verdict.value)} sur une classe allant de ${arrondi(matiere.minimum)} à ${arrondi(matiere.maximum)}`}
            >
              <span class="rail"></span>
              {#if matiere.classAverage !== undefined}
                <span class="marque classe-marque" style={`left:${position(matiere.classAverage, matiere.minimum, matiere.maximum)}%`}></span>
              {/if}
              <span class="marque moi" style={`left:${position(matiere.verdict.value, matiere.minimum, matiere.maximum)}%`}></span>
              <span class="bornes"><span>{arrondi(matiere.minimum)}</span><span>{arrondi(matiere.maximum)}</span></span>
            </div>
          {/if}

          {#if matiere.appreciation}
            <p class="appreciation">{matiere.appreciation}</p>
          {/if}

          {#each matiere.notes as note (note.id)}
            <article class="note" id={`note-${note.id}`}>
              <div class="note-texte">
                <p class="note-titre">{note.label || 'Évaluation'}</p>
                <p class="discret">
                  {[note.kind, note.date ? longDate(note.date) : '', `coef. ${note.coefficient}`]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {#if !note.counted}
                  <!-- Une note hors moyenne comptée fausserait tout : le dire évite un calcul faux. -->
                  <p class="jeton alerte">Ne compte pas dans la moyenne</p>
                {/if}
                {#if note.comment}<p class="discret" style="margin-top:4px">{note.comment}</p>{/if}
                {#each note.skills as competence (competence.label)}
                  <p class="competence">{competence.label} · {competence.level}</p>
                {/each}
              </div>
              <div class="note-valeur">
                <p class="valeur nombre">{brut(note.value)}<span class="sur">/{note.scale}</span></p>
                {#if note.classAverage !== undefined}
                  <p class="discret nombre">classe {arrondi(note.classAverage)}</p>
                {/if}
              </div>
            </article>
          {:else}
            <p class="discret" style="padding:10px 0">Aucune note dans cette matière.</p>
          {/each}
        </div>
      </details>
    {:else}
      <div style="padding:14px">
        <Vide titre="Aucune note" description="Rien n’a encore été saisi pour cette période." />
      </div>
    {/each}
  </div>
</section>
{/if}

<section class="panneau" style="margin-top:18px" aria-labelledby="t-simul">
  <div class="tete-panneau"><h2 id="t-simul">Simulation</h2></div>
  <div class="corps-panneau">
    <p class="discret" style="margin-bottom:12px">
      « Si je prends 14 au prochain devoir, ma moyenne devient… » — et l’inverse : quelle note
      viser pour atteindre un objectif. Toujours dans une matière : on ne passe pas un devoir
      dans toutes à la fois.
    </p>
    <form method="GET" class="formulaire">
      {#if data.periode}<input type="hidden" name="periode" value={data.periode.code} />{/if}
      <label class="pile" style="gap:4px;flex:1;min-width:170px">
        <span class="minuscule">Matière</span>
        <select class="champ" name="matiere">
          {#each data.matieres as matiere (matiere.subject)}
            <option value={matiere.subject} selected={matiere.subject === data.matiere}>{matiere.subject}</option>
          {/each}
        </select>
      </label>
      <label class="pile" style="gap:4px;width:130px">
        <span class="minuscule">Note obtenue</span>
        <input class="champ" name="note" type="number" min="0" max="20" step="0.25" value={data.valeur ?? ''} />
      </label>
      <label class="pile" style="gap:4px;width:130px">
        <span class="minuscule">Objectif</span>
        <input class="champ" name="objectif" type="number" min="0" max="20" step="0.25" value={data.objectif ?? ''} />
      </label>
      <button class="bouton primaire">Calculer</button>
    </form>

    {#if data.simulation}
      <div class="resultat" style={`--fond-matiere:${tonalite.fond};--encre-matiere:${tonalite.encre}`} role="status">
        <p>
          <strong>{data.matiere}</strong> : {arrondi(data.simulation.before)} →
          <strong class="nombre">{arrondi(data.simulation.after)}</strong>
          {#if data.simulation.delta !== undefined}
            <span class="discret nombre">
              ({data.simulation.delta >= 0 ? '+' : ''}{data.simulation.delta.toFixed(2).replace('.', ',')})
            </span>
          {/if}
        </p>
        {#if data.generaleApres !== null && data.generaleAvant !== null}
          <p class="discret">
            Moyenne générale : {arrondi(data.generaleAvant)} → <strong class="nombre">{arrondi(data.generaleApres)}</strong>
          </p>
        {/if}
      </div>
    {/if}

    {#if data.vise}
      <p style="margin-top:10px" role="status">
        {#if data.vise.reachable}
          Il faut viser <strong class="nombre">{data.vise.value.toFixed(2).replace('.', ',')}</strong> au prochain
          devoir de {data.matiere}.
        {:else}
          <!-- Répondre 27/20 serait juste mathématiquement et inutile pratiquement. -->
          Cet objectif est hors d’atteinte avec une seule note.
        {/if}
      </p>
    {/if}
  </div>
</section>

<style>
  .generale .chiffres { display: flex; align-items: center; gap: 22px; flex-wrap: wrap; }
  .grande { font-size: 2.6rem; font-weight: 700; line-height: 1; color: var(--accent); }
  .sur { font-size: 0.5em; color: var(--encre-douce); font-weight: 600; }
  .reperes { display: flex; gap: 20px; margin: 0; }
  .reperes div { display: flex; flex-direction: column; gap: 2px; }
  .reperes dt { color: var(--encre-douce); font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 650; }
  .reperes dd { margin: 0; font-weight: 650; }

  .explication {
    margin-top: 12px;
    padding: 10px 12px;
    border-left: 3px solid var(--accent);
    background: var(--accent-doux);
    color: var(--encre);
    border-radius: 0 var(--rayon-petit) var(--rayon-petit) 0;
    font-size: 0.88rem;
  }

  /* ————————————————————————————— relevé */

  .matiere { border-bottom: 1px solid var(--bordure-douce); }
  .matiere:last-child { border-bottom: 0; }

  .matiere summary {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px 10px 0;
    cursor: pointer;
    min-height: 52px;
    list-style: none;
  }
  .matiere summary::-webkit-details-marker { display: none; }
  .matiere summary:hover { background: var(--surface-2); }

  .filet { width: 5px; align-self: stretch; background: var(--encre-matiere); border-radius: 0 3px 3px 0; flex: none; }
  .nom { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; align-items: flex-start; }
  .libelle { font-weight: 650; }
  .detail { font-size: 0.82rem; }

  .moyenne { font-weight: 700; font-size: 1.15rem; min-width: 3.4rem; text-align: right; }
  .classe { min-width: 3.4rem; text-align: right; font-size: 0.9rem; }

  .detail-matiere { padding: 4px 14px 14px 19px; background: var(--surface-2); }

  .echelle { position: relative; height: 34px; margin: 10px 0 14px; }
  .rail { position: absolute; left: 0; right: 0; top: 9px; height: 6px; border-radius: 999px; background: var(--surface-3); }
  .marque { position: absolute; top: 4px; width: 4px; height: 16px; border-radius: 2px; transform: translateX(-2px); }
  .marque.moi { background: var(--encre-matiere); height: 20px; top: 2px; width: 5px; }
  .marque.classe-marque { background: var(--encre-douce); }
  .bornes { position: absolute; inset: auto 0 0 0; display: flex; justify-content: space-between; font-size: 0.74rem; color: var(--encre-douce); }

  .appreciation { font-size: 0.88rem; color: var(--encre-douce); margin-bottom: 10px; }

  .note {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 9px 0;
    border-top: 1px solid var(--bordure-douce);
  }
  .note-texte { flex: 1; min-width: 0; }
  .note-titre { font-weight: 600; font-size: 0.94rem; }

  /* En chronologie, la note porte son filet de matière : sans lui, tout se ressemble. */
  .note.recente { padding: 11px 14px 11px 0; border-top: 0; border-bottom: 1px solid var(--bordure-douce); }
  .note.recente:last-child { border-bottom: 0; }
  .note.recente .filet {
    width: 5px;
    align-self: stretch;
    min-height: 44px;
    background: var(--encre-matiere);
    border-radius: 0 3px 3px 0;
    flex: none;
  }
  .note-valeur { text-align: right; }
  .valeur { font-weight: 700; font-size: 1.25rem; }
  .competence { font-size: 0.82rem; color: var(--encre-douce); margin-top: 2px; }

  /* ————————————————————————————— simulation */

  .formulaire { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; }
  .resultat {
    margin-top: 14px;
    padding: 12px 14px;
    border-radius: var(--rayon-petit);
    background: var(--fond-matiere);
    color: var(--encre-matiere);
  }
  .resultat .discret { color: color-mix(in srgb, var(--encre-matiere) 80%, transparent); }
</style>
