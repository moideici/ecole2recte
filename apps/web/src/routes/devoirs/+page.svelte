<script lang="ts">
  import { enhance } from '$app/forms'
  import EnTete from '$lib/components/EnTete.svelte'
  import Actualiser from '$lib/components/Actualiser.svelte'
  import Vide from '$lib/components/Vide.svelte'
  import ErreurSection from '$lib/components/ErreurSection.svelte'
  import { longDate, matches, relativeDay, shortDate } from '@ecole2recte/protocol'
  import { couleurMatiere } from '$lib/matiereCouleur.js'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  let filtre = $state<'afaire' | 'evaluations' | 'faits' | 'tout'>('afaire')
  let recherche = $state('')

  const visibles = $derived(
    data.devoirs
      .filter((devoir) => {
        if (filtre === 'afaire') return !devoir.done
        if (filtre === 'evaluations') return devoir.exam && !devoir.done
        if (filtre === 'faits') return devoir.done
        return true
      })
      .filter((devoir) => matches(recherche, devoir.subject, devoir.content))
      .sort((gauche, droite) => gauche.dueDate.localeCompare(droite.dueDate)),
  )

  const parJour = $derived(
    visibles.reduce<Record<string, typeof visibles>>((groupes, devoir) => {
      ;(groupes[devoir.dueDate] ??= []).push(devoir)
      return groupes
    }, {}),
  )

  const restants = $derived(data.devoirs.filter((devoir) => !devoir.done && devoir.dueDate >= data.jour).length)
  const evaluations = $derived(data.devoirs.filter((devoir) => devoir.exam && devoir.dueDate >= data.jour).length)

  const FILTRES: Array<[typeof filtre, string]> = [
    ['afaire', 'À faire'],
    ['evaluations', 'Évaluations'],
    ['faits', 'Faits'],
    ['tout', 'Tout'],
  ]
</script>

<svelte:head><title>Travail à faire — ecole2recte</title></svelte:head>

<EnTete
  surtitre="Cahier de textes"
  titre="Travail à faire"
  soustitre={restants === 0
    ? 'Rien à faire pour l’instant'
    : `${restants} devoir${restants > 1 ? 's' : ''}${evaluations > 0 ? ` · ${evaluations} évaluation${evaluations > 1 ? 's' : ''}` : ''}`}
>
  {#snippet actions()}
    <Actualiser />
  {/snippet}
</EnTete>

<div class="onglets" role="group" aria-label="Filtre">
  {#each FILTRES as [valeur, libelle] (valeur)}
    <button aria-pressed={filtre === valeur} onclick={() => (filtre = valeur)}>{libelle}</button>
  {/each}
</div>

<label class="pile chercher">
  <span class="minuscule">Rechercher</span>
  <input class="champ" bind:value={recherche} placeholder="Une matière, un mot…" type="search" />
</label>

{#if data.erreur}
  <ErreurSection message="Le cahier de textes n’a pas pu être chargé." cause={data.erreur.message} />
{/if}

{#if !data.cochable}
  <p class="discret" style="margin-bottom:12px">
    L’état « fait » est celui d’ÉcoleDirecte : il se modifie depuis le compte de l’élève,
    quand l’écriture a été ouverte.
  </p>
{/if}

{#each Object.entries(parJour) as [date, devoirs] (date)}
  <section class="panneau jour" class:passe={date < data.jour}>
    <div class="tete-panneau">
      <h2>Pour {longDate(date)}</h2>
      <span class="jeton" class:erreur-jeton={date < data.jour} class:accent={date >= data.jour}>{relativeDay(date, data.jour)}</span>
      <span class="espace"></span>
      <span class="discret">{devoirs.length} devoir{devoirs.length > 1 ? 's' : ''}</span>
      <a class="pastille" href={`/devoirs/${date}`}>Ouvrir la journée</a>
    </div>
    <div class="corps-panneau serre">
      {#each devoirs as devoir (devoir.id)}
        {@const couleur = couleurMatiere(devoir.subject)}
        <div
          class="devoir"
          style={`--fond-matiere:${couleur.fond};--encre-matiere:${couleur.encre}`}
          class:fait={devoir.done}
        >
          <span class="filet" aria-hidden="true"></span>
          {#if data.cochable}
            <form method="POST" action="?/cocher" use:enhance class="coche">
              <input type="hidden" name="devoir" value={devoir.id} />
              <input type="hidden" name="fait" value={String(!devoir.done)} />
              <button class="case" aria-pressed={devoir.done} aria-label={devoir.done ? 'Marquer à faire' : 'Marquer fait'}>
                {devoir.done ? '✓' : ''}
              </button>
              <span class="legende-case" aria-hidden="true">{devoir.done ? 'Fait' : 'À faire'}</span>
            </form>
          {/if}
          <!-- Cliquer ouvre la journée sur ce devoir : l'énoncé complet, ses pièces jointes
               et ce qui a été fait en cours y sont. -->
          <a class="texte" href={`/devoirs/${date}#${devoir.id}`}>
            <span class="rangee" style="gap:6px;flex-wrap:wrap">
              <span class="etiquette-matiere">{devoir.subject}</span>
              {#if devoir.exam}<span class="jeton alerte">Évaluation</span>{/if}
              {#if devoir.done}<span class="jeton succes">Fait</span>{/if}
              {#if devoir.onlineSubmission}<span class="jeton erreur-jeton">À déposer en ligne</span>{/if}
            </span>
            {#if devoir.content}
              <span class="contenu">{devoir.content}</span>
            {:else if devoir.detaille}
              <span class="discret">Aucun énoncé saisi.</span>
            {:else}
              <span class="discret">Ouvrir pour lire l’énoncé.</span>
            {/if}
            {#if devoir.givenOn}
              <span class="donne">Donné le {shortDate(devoir.givenOn)}</span>
            {/if}
            {#if devoir.attachments.length > 0}
              <span class="jeton">{devoir.attachments.length} pièce{devoir.attachments.length > 1 ? 's' : ''} jointe{devoir.attachments.length > 1 ? 's' : ''}</span>
            {/if}
          </a>
          <span class="chevron" aria-hidden="true">›</span>
        </div>
      {/each}
    </div>
  </section>
{:else}
  <Vide
    titre={recherche ? 'Aucun résultat' : 'Rien à faire'}
    description={recherche ? 'Essaie un autre mot, ou change de filtre.' : 'Tous les devoirs connus sont cochés.'}
  />
{/each}

<style>
  .chercher { gap: 6px; margin-bottom: 16px; max-width: 420px; }
  .jour { margin-bottom: 16px; }
  .jour.passe .tete-panneau h2 { color: var(--erreur); }

  .devoir {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-right: 12px;
    border-bottom: 1px solid var(--bordure-douce);
  }
  .devoir:last-child { border-bottom: 0; }
  .devoir:hover { background: var(--surface-2); }
  .filet { width: 5px; align-self: stretch; min-height: 48px; background: var(--encre-matiere); border-radius: 0 3px 3px 0; flex: none; }

  .texte {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
    align-items: flex-start;
    padding: 12px 0;
    text-decoration: none;
    color: inherit;
  }
  .contenu {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    white-space: pre-wrap;
  }
  .fait .contenu { color: var(--encre-douce); }
  .chevron { color: var(--encre-douce); font-size: 1.3rem; flex: none; }
  .donne { font-size: 0.78rem; color: var(--encre-douce); }
  .coche { display: flex; flex-direction: column; align-items: center; gap: 2px; flex: none; }
  .legende-case { font-size: 0.64rem; font-weight: 650; text-transform: uppercase; letter-spacing: 0.04em; color: var(--encre-douce); }
  .devoir.fait { opacity: 0.8; }

  .case {
    width: 28px;
    height: 28px;
    min-width: 28px;
    border-radius: 999px;
    border: 2px solid var(--bordure);
    background: var(--surface);
    color: var(--accent-encre);
    font-size: 0.9rem;
    cursor: pointer;
    line-height: 1;
  }
  .case[aria-pressed='true'] { background: var(--accent); border-color: var(--accent); }
</style>
