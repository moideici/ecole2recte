<script lang="ts">
  import { enhance } from '$app/forms'
  import EnTete from '$lib/components/EnTete.svelte'
  import Vide from '$lib/components/Vide.svelte'
  import ErreurSection from '$lib/components/ErreurSection.svelte'
  import { matches, relativeDay } from '@ecole2recte/protocol'
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
</script>

<svelte:head><title>Devoirs — ecole2recte</title></svelte:head>

<EnTete
  surtitre="Cahier de textes"
  titre="Devoirs"
  soustitre={restants === 0 ? 'Rien à faire pour l’instant' : `${restants} devoir${restants > 1 ? 's' : ''} à faire`}
/>

<label class="pile" style="gap:6px;margin-bottom:12px">
  <span class="minuscule">Rechercher</span>
  <input class="champ" bind:value={recherche} placeholder="Une matière, un mot…" type="search" />
</label>

<div class="defilement" role="group" aria-label="Filtre" style="margin-bottom:14px">
  {#each [['afaire', 'À faire'], ['evaluations', 'Évaluations'], ['faits', 'Faits'], ['tout', 'Tout']] as [valeur, libelle] (valeur)}
    <button class="pastille" aria-pressed={filtre === valeur} onclick={() => (filtre = valeur as typeof filtre)}>
      {libelle}
    </button>
  {/each}
</div>

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
  <h2 class="jour" class:passe={date < data.jour}>
    {relativeDay(date, data.jour)}<span class="discret"> · {devoirs.length}</span>
  </h2>
  <div class="pile" style="margin-bottom:18px">
    {#each devoirs as devoir (devoir.id)}
      <article class="carte" id={devoir.id}>
        <div class="rangee" style="align-items:flex-start">
          {#if data.cochable}
            <form method="POST" action="?/cocher" use:enhance>
              <input type="hidden" name="devoir" value={devoir.id} />
              <input type="hidden" name="fait" value={String(!devoir.done)} />
              <button class="case" aria-pressed={devoir.done} aria-label={devoir.done ? 'Marquer à faire' : 'Marquer fait'}>
                {devoir.done ? '✓' : ''}
              </button>
            </form>
          {/if}
          <div style="flex:1;min-width:0">
            <p>
              <span
                class="etiquette-matiere"
                style={`--fond-matiere:${couleurMatiere(devoir.subject).fond};--encre-matiere:${couleurMatiere(devoir.subject).encre}`}
              >{devoir.subject}</span>
              {#if devoir.exam}<span class="discret"> · Évaluation</span>{/if}
            </p>
            {#if devoir.content}<p class="discret">{devoir.content}</p>{/if}
            {#if devoir.onlineSubmission}
              <!-- Le taire serait pire : on cocherait une case en croyant avoir rendu. -->
              <p class="avertissement">
                Ce devoir attend une copie déposée en ligne. L’application ne sait pas déposer :
                cocher ici ne rend rien.
              </p>
            {/if}
            {#each devoir.attachments as piece (piece.id)}
              <a class="piece" href={`/piece-jointe/${piece.source}/${piece.id}?nom=${encodeURIComponent(piece.name)}&type=${encodeURIComponent(piece.downloadType)}`}>
                {piece.name}
              </a>
            {/each}
          </div>
        </div>
      </article>
    {/each}
  </div>
{:else}
  <Vide
    titre={recherche ? 'Aucun résultat' : 'Rien à faire'}
    description={recherche ? 'Essaie un autre mot, ou change de filtre.' : 'Tous les devoirs connus sont cochés.'}
  />
{/each}

<style>
  .jour { margin: 18px 0 8px; }
  .jour.passe { color: var(--erreur); }
  .case {
    width: 30px;
    height: 30px;
    min-width: 30px;
    border-radius: 8px;
    border: 2px solid var(--bordure);
    background: var(--surface);
    color: var(--accent-encre);
    font-size: 0.9rem;
    cursor: pointer;
    line-height: 1;
  }
  .case[aria-pressed='true'] { background: var(--accent); border-color: var(--accent); }
  .avertissement { margin-top: 6px; color: var(--alerte); font-size: 0.85rem; }
  .piece { display: inline-block; margin-top: 6px; margin-right: 10px; font-size: 0.88rem; }
</style>
