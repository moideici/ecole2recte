<script lang="ts">
  import { enhance } from '$app/forms'
  import EnTete from '$lib/components/EnTete.svelte'
  import Vide from '$lib/components/Vide.svelte'
  import { longDate, relativeDay, timeOf } from '@ecole2recte/protocol'
  import { couleurMatiere } from '$lib/matiereCouleur.js'
  import type { ActionData, PageData } from './$types'

  let { data, form }: { data: PageData; form: ActionData } = $props()

  /** Le formulaire de commentaire ouvert, s'il y en a un : un seul à la fois. */
  let commente = $state('')

  function lien(piece: { source: string; id: string; name: string; downloadType: string }): string {
    return `/piece-jointe/${piece.source}/${piece.id}?nom=${encodeURIComponent(piece.name)}&type=${encodeURIComponent(piece.downloadType)}`
  }
</script>

<svelte:head><title>{longDate(data.date)} — ecole2recte</title></svelte:head>

<a class="pastille retour" href="/devoirs">‹ Travail à faire</a>

<EnTete surtitre={relativeDay(data.date, data.jour)} titre={longDate(data.date)}>
  {#snippet actions()}
    <a class="pastille" href={`/devoirs/${data.precedent}`}>‹ Veille</a>
    <a class="pastille" href={`/devoirs/${data.suivant}`}>Lendemain ›</a>
  {/snippet}
</EnTete>

{#if form && 'message' in form && form.message}
  <p class="erreur" role="alert" style="margin-bottom:14px">{form.message}</p>
{/if}
{#if form && 'commente' in form && form.commente}
  <p class="jeton succes" role="status" style="margin-bottom:14px">Commentaire envoyé.</p>
{/if}

<section class="panneau" style="margin-bottom:18px">
  <div class="tete-panneau">
    <h2>À faire pour ce jour</h2>
    <span class="espace"></span>
    <span class="jeton">{data.devoirs.length}</span>
  </div>
  <div class="corps-panneau serre">
    {#each data.devoirs as devoir (devoir.id)}
      {@const couleur = couleurMatiere(devoir.subject)}
      <article
        class="entree"
        id={devoir.id}
        style={`--fond-matiere:${couleur.fond};--encre-matiere:${couleur.encre}`}
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
          {#if devoir.content}
            <p class="enonce">{devoir.content}</p>
          {:else}
            <p class="discret">Aucun énoncé n’a été saisi pour ce devoir.</p>
          {/if}
          {#if devoir.givenOn}<p class="discret">Donné le {longDate(devoir.givenOn)}</p>{/if}
          {#if devoir.onlineSubmission}
            <!-- Le taire serait pire : on cocherait une case en croyant avoir rendu. -->
            <p class="jeton erreur-jeton">Copie à déposer en ligne — l’application ne sait pas déposer</p>
          {/if}
          {#each devoir.attachments as piece (piece.id)}
            <a class="piece" href={lien(piece)}>{piece.name}</a>
          {/each}

          {#if data.commentable}
            {#if commente === devoir.id}
              <form method="POST" action="?/commenter" class="commentaire" use:enhance={() => async ({ update }) => {
                await update()
                commente = ''
              }}>
                <input type="hidden" name="contenu" value={devoir.id} />
                <label class="pile" style="gap:4px">
                  <span class="minuscule">Commentaire pour le professeur</span>
                  <textarea class="champ zone" name="message" rows="3" required></textarea>
                </label>
                <p class="discret">
                  Il part chez le professeur et ne se retire pas depuis l’application.
                </p>
                <div class="rangee" style="gap:8px">
                  <button class="bouton primaire">Envoyer</button>
                  <button class="bouton" type="button" onclick={() => (commente = '')}>Annuler</button>
                </div>
              </form>
            {:else}
              <button class="bouton lien-commenter" onclick={() => (commente = devoir.id)}>Commenter</button>
            {/if}
          {/if}
        </div>
      </article>
    {:else}
      <div style="padding:14px">
        <Vide
          titre={data.charge ? 'Rien à faire pour ce jour' : 'Journée non chargée'}
          description={data.charge
            ? 'Aucun devoir n’est inscrit pour cette date.'
            : 'Le détail de cette journée n’a pas pu être lu.'}
        />
      </div>
    {/each}
  </div>
</section>

<!--
  Le contenu de séance : ce qui a été fait en cours. Le protocole le lisait déjà ; aucun
  écran ne le montrait, et il ne servait donc à rien.
-->
<section class="panneau" style="margin-bottom:18px">
  <div class="tete-panneau"><h2>Contenu des séances</h2></div>
  <div class="corps-panneau serre">
    {#each data.seances as seance (seance.id)}
      {@const couleur = couleurMatiere(seance.subject)}
      <article class="entree" style={`--fond-matiere:${couleur.fond};--encre-matiere:${couleur.encre}`}>
        <span class="filet" aria-hidden="true"></span>
        <div class="texte">
          <span class="etiquette-matiere">{seance.subject}</span>
          <p class="enonce">{seance.content}</p>
          {#each seance.attachments as piece (piece.id)}
            <a class="piece" href={lien(piece)}>{piece.name}</a>
          {/each}
        </div>
      </article>
    {:else}
      <div style="padding:14px">
        <Vide titre="Aucun contenu de séance" description="Rien n’a été saisi par les professeurs pour ce jour." />
      </div>
    {/each}
  </div>
</section>

{#if data.cours.length > 0}
  <section class="panneau">
    <div class="tete-panneau">
      <h2>Les cours de la journée</h2>
      <span class="espace"></span>
      <a class="discret" href={`/emploi-du-temps?jour=${data.date}&vue=jour`}>Emploi du temps</a>
    </div>
    <div class="corps-panneau serre">
      {#each data.cours as cours (cours.id)}
        {@const couleur = couleurMatiere(cours.subject)}
        <p class="cours" class:annule={cours.canceled} style={`--encre-matiere:${couleur.encre}`}>
          <span class="filet" aria-hidden="true"></span>
          <span class="heure nombre">{timeOf(cours.start)} – {timeOf(cours.end)}</span>
          <span class="matiere">{cours.subject}</span>
          <span class="discret">{[cours.room, cours.teacher].filter(Boolean).join(' · ')}</span>
        </p>
      {/each}
    </div>
  </section>
{/if}

<style>
  .retour { margin-bottom: 14px; display: inline-flex; }

  .entree {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px 12px 0;
    border-bottom: 1px solid var(--bordure-douce);
  }
  .entree:last-child { border-bottom: 0; }
  .filet { width: 5px; align-self: stretch; min-height: 34px; background: var(--encre-matiere); border-radius: 0 3px 3px 0; flex: none; }
  .texte { flex: 1; min-width: 0; }
  .enonce { margin-top: 4px; white-space: pre-wrap; line-height: 1.55; }

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
  .zone { min-height: 84px; padding: 10px 12px; resize: vertical; line-height: 1.5; }
  .commentaire { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
  .lien-commenter { margin-top: 8px; min-height: 36px; padding: 0 12px; font-size: 0.88rem; }

  .cours {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 14px 9px 0;
    border-bottom: 1px solid var(--bordure-douce);
  }
  .cours:last-child { border-bottom: 0; }
  .cours .filet { min-height: 26px; }
  .heure { min-width: 7.6rem; }
  .matiere { font-weight: 600; }
  .annule .matiere { text-decoration: line-through; color: var(--encre-douce); }
</style>
