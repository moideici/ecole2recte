<script lang="ts">
  import { enhance } from '$app/forms'
  import EnTete from '$lib/components/EnTete.svelte'
  import Vide from '$lib/components/Vide.svelte'
  import ErreurSection from '$lib/components/ErreurSection.svelte'
  import { longDate, matches, relativeDay } from '@ecole2recte/protocol'
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
/>

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
      <h2>{relativeDay(date, data.jour)}</h2>
      <span class="discret">{longDate(date)}</span>
      <span class="espace"></span>
      <span class="jeton">{devoirs.length}</span>
    </div>
    <div class="corps-panneau serre">
      {#each devoirs as devoir (devoir.id)}
        {@const couleur = couleurMatiere(devoir.subject)}
        <article
          class="devoir"
          id={devoir.id}
          style={`--fond-matiere:${couleur.fond};--encre-matiere:${couleur.encre}`}
          class:fait={devoir.done}
        >
          <span class="filet" aria-hidden="true"></span>
          {#if data.cochable}
            <form method="POST" action="?/cocher" use:enhance>
              <input type="hidden" name="devoir" value={devoir.id} />
              <input type="hidden" name="fait" value={String(!devoir.done)} />
              <button class="case" aria-pressed={devoir.done} aria-label={devoir.done ? 'Marquer à faire' : 'Marquer fait'}>
                {devoir.done ? '✓' : ''}
              </button>
            </form>
          {/if}
          <div class="texte">
            <p class="rangee" style="gap:6px;flex-wrap:wrap">
              <span class="etiquette-matiere">{devoir.subject}</span>
              {#if devoir.exam}<span class="jeton alerte">Évaluation</span>{/if}
              {#if devoir.done}<span class="jeton succes">Fait</span>{/if}
            </p>
            {#if devoir.content}<p class="contenu">{devoir.content}</p>{/if}
            {#if devoir.givenOn}<p class="discret">Donné le {longDate(devoir.givenOn)}</p>{/if}
            {#if devoir.onlineSubmission}
              <!-- Le taire serait pire : on cocherait une case en croyant avoir rendu. -->
              <p class="jeton erreur-jeton">
                Copie à déposer en ligne — l’application ne sait pas déposer
              </p>
            {/if}
            {#each devoir.attachments as piece (piece.id)}
              <a
                class="piece"
                href={`/piece-jointe/${piece.source}/${piece.id}?nom=${encodeURIComponent(piece.name)}&type=${encodeURIComponent(piece.downloadType)}`}
              >{piece.name}</a>
            {/each}
          </div>
        </article>
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
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px 12px 0;
    border-bottom: 1px solid var(--bordure-douce);
  }
  .devoir:last-child { border-bottom: 0; }
  .filet { width: 5px; align-self: stretch; background: var(--encre-matiere); border-radius: 0 3px 3px 0; flex: none; }
  .texte { flex: 1; min-width: 0; }
  .contenu { margin-top: 4px; white-space: pre-wrap; }
  .fait .contenu { color: var(--encre-douce); }

  .case {
    width: 28px;
    height: 28px;
    min-width: 28px;
    margin-top: 2px;
    border-radius: 8px;
    border: 2px solid var(--bordure);
    background: var(--surface);
    color: var(--accent-encre);
    font-size: 0.9rem;
    cursor: pointer;
    line-height: 1;
  }
  .case[aria-pressed='true'] { background: var(--accent); border-color: var(--accent); }
  .piece { display: inline-block; margin-top: 6px; margin-right: 10px; font-size: 0.88rem; }
</style>
