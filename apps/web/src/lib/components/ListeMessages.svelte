<script lang="ts">
  import EnTete from '$lib/components/EnTete.svelte'
  import Vide from '$lib/components/Vide.svelte'
  import ErreurSection from '$lib/components/ErreurSection.svelte'
  import type { MessageFolder, MessageItem } from '@ecole2recte/protocol'
  import { MESSAGE_FOLDERS, MESSAGE_FOLDER_LABELS, listStamp, matches } from '@ecole2recte/protocol'

  /**
   * Une page de messagerie, commune aux élèves, aux familles et aux professeurs : seule
   * change l'adresse sous laquelle elle vit.
   */
  let {
    messages,
    dossier,
    page,
    jour,
    base,
    erreur = null,
  }: {
    messages: Array<MessageItem & { interlocuteur: string }>
    dossier: MessageFolder
    page: number
    jour: string
    base: string
    erreur?: { message: string } | null
  } = $props()

  let recherche = $state('')
  let nonLusSeuls = $state(false)

  const visibles = $derived(
    messages
      .filter((message) => dossier !== 'received' || !nonLusSeuls || !message.read)
      .filter((message) => matches(recherche, message.subject, message.interlocuteur, message.preview)),
  )
  const nonLus = $derived(messages.filter((message) => message.folder === 'received' && !message.read).length)
</script>

<EnTete
  surtitre="Messagerie"
  titre="Messages"
  soustitre={dossier !== 'received'
    ? MESSAGE_FOLDER_LABELS[dossier]
    : nonLus === 0
      ? 'Tout est lu'
      : `${nonLus} message${nonLus > 1 ? 's' : ''} non lu${nonLus > 1 ? 's' : ''}`}
/>

<label class="pile" style="gap:6px;margin-bottom:12px">
  <span class="minuscule">Rechercher</span>
  <input
    class="champ"
    bind:value={recherche}
    type="search"
    placeholder={dossier === 'sent' ? 'Un destinataire, un objet…' : 'Un expéditeur, un objet…'}
  />
</label>

<div class="defilement" role="group" aria-label="Dossier" style="margin-bottom:10px">
  {#each MESSAGE_FOLDERS as entree (entree)}
    <a class="pastille" href={`${base}?dossier=${entree}`} aria-current={entree === dossier}>
      {MESSAGE_FOLDER_LABELS[entree]}
    </a>
  {/each}
</div>

{#if dossier === 'received'}
  <div class="defilement" role="group" aria-label="Lecture" style="margin-bottom:14px">
    <button class="pastille" aria-pressed={!nonLusSeuls} onclick={() => (nonLusSeuls = false)}>Tous</button>
    <button class="pastille" aria-pressed={nonLusSeuls} onclick={() => (nonLusSeuls = true)}>Non lus</button>
  </div>
{/if}

{#if erreur}
  <ErreurSection message="La messagerie n’a pas pu être chargée." cause={erreur.message} />
{/if}

<div class="pile">
  {#each visibles as message (message.id)}
    <a class="carte rangee" href={`${base}/${message.id}?dossier=${dossier}`} style="align-items:flex-start">
      <div style="flex:1;min-width:0">
        <p class:gras={!message.read}>{message.interlocuteur}</p>
        <p class="objet" class:gras={!message.read}>{message.subject}</p>
        {#if message.preview}<p class="extrait">{message.preview}</p>{/if}
      </div>
      <div style="text-align:right">
        {#if message.date}<p class="discret">{listStamp(message.date, jour)}</p>{/if}
        {#if !message.read}<span class="point" aria-label="Non lu"></span>{/if}
      </div>
    </a>
  {:else}
    <Vide
      titre={recherche ? 'Aucun résultat' : 'Aucun message'}
      description={recherche ? 'Rien ne correspond à ce filtre.' : 'Ce dossier est vide.'}
    />
  {/each}
</div>

<!-- L'année entière dépasse une page : elle se charge à la demande, jamais d'un coup. -->
<div class="rangee" style="margin-top:18px;justify-content:center;gap:12px">
  {#if page > 0}
    <a class="bouton" href={`${base}?dossier=${dossier}&page=${page - 1}`}>Page précédente</a>
  {/if}
  {#if messages.length > 0}
    <a class="bouton" href={`${base}?dossier=${dossier}&page=${page + 1}`}>Messages plus anciens</a>
  {/if}
</div>

<style>
  .gras { font-weight: 700; }
  .objet { margin-top: 2px; }
  .extrait {
    color: var(--encre-douce);
    font-size: 0.88rem;
    margin-top: 4px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .point { display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: var(--accent); margin-top: 6px; }
  a.carte { text-decoration: none; }
</style>
