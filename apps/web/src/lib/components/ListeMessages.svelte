<script lang="ts">
  import { onMount } from 'svelte'
  import { lireEtat, basculer, estNouveau } from '$lib/luLocal.js'
  import EnTete from '$lib/components/EnTete.svelte'
  import Actualiser from '$lib/components/Actualiser.svelte'
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

  let etat = $state<Record<string, boolean>>({})
  onMount(() => {
    try { etat = lireEtat(localStorage.getItem('e2r-messages-lus')) } catch { /* Stockage indisponible. */ }
  })
  function estLu(message: MessageItem): boolean {
    return Object.hasOwn(etat, message.id) ? etat[message.id]! : message.read
  }
  function marquer(message: MessageItem) {
    etat = basculer(etat, message.id, estLu(message))
    try { localStorage.setItem('e2r-messages-lus', JSON.stringify(etat)) } catch { /* État conservé en mémoire. */ }
  }

  let recherche = $state('')
  let nonLusSeuls = $state(false)

  const visibles = $derived(
    messages
      .filter((message) => dossier !== 'received' || !nonLusSeuls || !estLu(message))
      .filter((message) => matches(recherche, message.subject, message.interlocuteur, message.preview)),
  )
  const nonLus = $derived(messages.filter((message) => message.folder === 'received' && !estLu(message)).length)
</script>

<EnTete
  surtitre="Messagerie"
  titre="Messages"
  soustitre={dossier !== 'received'
    ? MESSAGE_FOLDER_LABELS[dossier]
    : nonLus === 0
      ? 'Tout est lu'
      : `${nonLus} message${nonLus > 1 ? 's' : ''} non lu${nonLus > 1 ? 's' : ''}`}
>
  {#snippet actions()}<Actualiser />{/snippet}
</EnTete>

<div class="onglets" role="group" aria-label="Dossier">
  {#each MESSAGE_FOLDERS as entree (entree)}
    <a href={`${base}?dossier=${entree}`} aria-current={entree === dossier}>{MESSAGE_FOLDER_LABELS[entree]}</a>
  {/each}
</div>

<div class="commandes">
  <label class="pile" style="gap:6px;flex:1;min-width:200px;max-width:420px">
    <span class="minuscule">Rechercher</span>
    <input
      class="champ"
      bind:value={recherche}
      type="search"
      placeholder={dossier === 'sent' ? 'Un destinataire, un objet…' : 'Un expéditeur, un objet…'}
    />
  </label>
  {#if dossier === 'received'}
    <div class="defilement" role="group" aria-label="Lecture">
      <button class="pastille" aria-pressed={!nonLusSeuls} onclick={() => (nonLusSeuls = false)}>Tous</button>
      <button class="pastille" aria-pressed={nonLusSeuls} onclick={() => (nonLusSeuls = true)}>Non lus</button>
    </div>
  {/if}
</div>

{#if erreur}
  <ErreurSection message="La messagerie n’a pas pu être chargée." cause={erreur.message} />
{/if}

<p class="discret">Ce marquage reste sur cet appareil, rien n'est modifié chez ÉcoleDirecte.</p>

<section class="panneau">
  <div class="corps-panneau serre">
    {#each visibles as message (message.id)}
      <div class="message">
      <a class="ligne" class:nonlu={!estLu(message)} href={`${base}/${message.id}?dossier=${dossier}`}>
        <span class="point" aria-hidden="true"></span>
        <span class="texte">
          <span class="de" class:gras={!estLu(message)}>{message.interlocuteur}</span>
          <span class="objet" class:gras={!estLu(message)}>{message.subject}</span>
          {#if message.preview}<span class="extrait">{message.preview}</span>{/if}
        </span>
        <span class="quand discret">
          {#if message.date}{listStamp(message.date, jour)}{/if}
          {#if message.date && estNouveau(message.date.slice(0, 10), jour)}<span class="jeton accent">Nouveau</span>{/if}
          {#if !estLu(message)}<span class="jeton accent">Non lu</span>{/if}
        </span>
      </a>
      <button class="pastille" onclick={() => marquer(message)}>Marquer comme {estLu(message) ? "non lu" : "lu"}</button>
      </div>
    {:else}
      <div style="padding:14px">
        <Vide
          titre={recherche ? 'Aucun résultat' : 'Aucun message'}
          description={recherche ? 'Rien ne correspond à ce filtre.' : 'Ce dossier est vide.'}
        />
      </div>
    {/each}
  </div>
</section>

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
  .commandes { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }

  .ligne {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 11px 14px;
    border-bottom: 1px solid var(--bordure-douce);
    text-decoration: none;
    color: inherit;
  }
  .message { border-bottom: 1px solid var(--bordure-douce); padding-bottom: 8px; }
  .message:last-child { border-bottom: 0; }
  .message > button { margin-left: 14px; }
  .ligne:hover { background: var(--surface-2); }
  .ligne.nonlu { background: color-mix(in srgb, var(--accent-doux) 45%, var(--surface)); }

  .point { width: 8px; height: 8px; border-radius: 50%; background: transparent; margin-top: 8px; flex: none; }
  .nonlu .point { background: var(--accent); }

  .texte { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .gras { font-weight: 700; }
  .de { font-size: 0.94rem; }
  .objet { font-size: 0.94rem; }
  .quand { text-align: right; white-space: nowrap; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
  .extrait {
    color: var(--encre-douce);
    font-size: 0.86rem;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
