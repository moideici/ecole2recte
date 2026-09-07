<script lang="ts">
  import EnTete from '$lib/components/EnTete.svelte'
  import Vide from '$lib/components/Vide.svelte'
  import ErreurSection from '$lib/components/ErreurSection.svelte'
  import { longDate } from '@ecole2recte/protocol'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()

  function arrondi(valeur: number | undefined): string {
    return valeur === undefined ? '—' : valeur.toFixed(2).replace('.', ',')
  }
</script>

<svelte:head><title>Notes — ecole2recte</title></svelte:head>

<EnTete
  surtitre={data.periode?.name ?? 'Bulletin'}
  titre="Notes"
  soustitre={data.generale.value === undefined
    ? 'Aucune moyenne'
    : `Moyenne ${arrondi(data.generale.value)}${data.generale.computed ? ' (calculée)' : ''}`}
/>

{#if data.periodes.length > 1}
  <div class="defilement" role="group" aria-label="Période" style="margin-bottom:14px">
    {#each data.periodes as periode (periode.code)}
      <a class="pastille" href={`?periode=${periode.code}`} aria-current={periode.code === data.periode?.code}>
        {periode.name}
      </a>
    {/each}
  </div>
{/if}

{#if data.erreur}
  <ErreurSection message="Les notes n’ont pas pu être chargées." cause={data.erreur.message} />
{/if}

{#if data.generale.computed && data.generale.value !== undefined}
  <p class="discret" style="margin-bottom:14px">
    L’établissement ne publie pas de moyenne générale : celle-ci est calculée à partir des
    notes qui comptent, avec leurs coefficients. Elle peut différer du bulletin.
  </p>
{/if}

{#if data.periode?.appreciation}
  <section class="carte" style="margin-bottom:18px">
    <h2>Conseil de classe</h2>
    <p style="margin-top:6px">{data.periode.appreciation}</p>
    <p class="discret" style="margin-top:6px">
      {[data.periode.headTeacher, data.periode.councilDate ? longDate(data.periode.councilDate) : '']
        .filter(Boolean)
        .join(' · ')}
    </p>
  </section>
{/if}

<h2>Moyennes par matière</h2>
<div class="enveloppe-large" style="margin:10px 0 24px">
  <table class="tableau">
    <thead>
      <tr><th>Matière</th><th>Moyenne</th><th>Classe</th><th>Coef.</th></tr>
    </thead>
    <tbody>
      {#each data.moyennes as moyenne (moyenne.subject + moyenne.periodCode)}
        <tr>
          <td>
            {moyenne.subject}
            {#if moyenne.teacher}<span class="discret" style="display:block">{moyenne.teacher}</span>{/if}
            {#if moyenne.appreciation}<span class="appreciation">{moyenne.appreciation}</span>{/if}
          </td>
          <td style="font-weight:650">{arrondi(moyenne.average)}</td>
          <td class="discret">{arrondi(moyenne.classAverage)}</td>
          <td class="discret">{moyenne.coefficient ?? '—'}</td>
        </tr>
      {:else}
        <tr><td colspan="4" class="discret">Aucune moyenne publiée.</td></tr>
      {/each}
    </tbody>
  </table>
</div>

<h2>Notes</h2>
<div class="pile" style="margin-top:10px">
  {#each data.notes as note (note.id)}
    <article class="carte">
      <div class="rangee" style="align-items:flex-start">
        <div style="flex:1;min-width:0">
          <p style="font-weight:600">{note.subject}</p>
          <p class="discret">{[note.label, note.kind, note.date ? longDate(note.date) : ''].filter(Boolean).join(' · ')}</p>
          {#if !note.counted}
            <!-- Une note hors moyenne comptée fausserait tout : le dire évite un calcul faux. -->
            <p class="mention">Ne compte pas dans la moyenne</p>
          {/if}
          {#if note.comment}<p class="discret" style="margin-top:4px">{note.comment}</p>{/if}
          {#each note.skills as competence (competence.label)}
            <p class="competence">{competence.label} · {competence.level}</p>
          {/each}
        </div>
        <div style="text-align:right">
          <p class="valeur">
            {note.value !== undefined ? note.value.toString().replace('.', ',') : '—'}<span class="discret">/{note.scale}</span>
          </p>
          <p class="discret">coef. {note.coefficient}</p>
          {#if note.classAverage !== undefined}
            <p class="discret">classe {arrondi(note.classAverage)}</p>
          {/if}
        </div>
      </div>
    </article>
  {:else}
    <Vide titre="Aucune note" description="Rien n’a encore été saisi pour cette période." />
  {/each}
</div>

<section class="carte" style="margin-top:24px">
  <h2>Simulateur</h2>
  <p class="discret" style="margin:6px 0 12px">
    « Si je prends 14 au prochain devoir, ma moyenne devient… » — et l’inverse : quelle note
    viser pour atteindre un objectif.
  </p>
  <form method="GET" class="rangee" style="flex-wrap:wrap;gap:10px">
    {#if data.periode}<input type="hidden" name="periode" value={data.periode.code} />{/if}
    <label class="pile" style="gap:4px;flex:1;min-width:150px">
      <span class="minuscule">Matière (facultatif)</span>
      <select class="champ" name="matiere">
        <option value="">Toutes</option>
        {#each data.moyennes as moyenne (moyenne.subject)}
          <option value={moyenne.subject} selected={moyenne.subject === data.matiere}>{moyenne.subject}</option>
        {/each}
      </select>
    </label>
    <label class="pile" style="gap:4px;width:120px">
      <span class="minuscule">Note obtenue</span>
      <input class="champ" name="note" type="number" min="0" max="20" step="0.25" />
    </label>
    <label class="pile" style="gap:4px;width:120px">
      <span class="minuscule">Objectif</span>
      <input class="champ" name="objectif" type="number" min="0" max="20" step="0.25" />
    </label>
    <button class="bouton primaire" style="align-self:flex-end">Calculer</button>
  </form>

  {#if data.simulation}
    <p style="margin-top:14px" role="status">
      Moyenne : {arrondi(data.simulation.before)} → <strong>{arrondi(data.simulation.after)}</strong>
      {#if data.simulation.delta !== undefined}
        <span class="discret">({data.simulation.delta >= 0 ? '+' : ''}{data.simulation.delta.toFixed(2).replace('.', ',')})</span>
      {/if}
    </p>
  {/if}

  {#if data.vise}
    <p style="margin-top:8px" role="status">
      {#if data.vise.reachable}
        Il faut viser <strong>{data.vise.value.toFixed(2).replace('.', ',')}</strong> au prochain devoir.
      {:else}
        <!-- Répondre 27/20 serait juste mathématiquement et inutile pratiquement. -->
        Cet objectif est hors d’atteinte avec une seule note.
      {/if}
    </p>
  {/if}
</section>

<style>
  .valeur { font-weight: 700; font-size: 1.3rem; font-variant-numeric: tabular-nums; }
  .mention { color: var(--alerte); font-size: 0.82rem; margin-top: 4px; }
  .competence { font-size: 0.84rem; color: var(--encre-douce); margin-top: 2px; }
  .appreciation { display: block; font-size: 0.84rem; color: var(--encre-douce); margin-top: 4px; }
</style>
