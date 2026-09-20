<script lang="ts">
  import EnTete from '$lib/components/EnTete.svelte'
  import type { MessageFolder, MessageItem } from '@ecole2recte/protocol'
  import { longDate, timeOf } from '@ecole2recte/protocol'

  /**
   * Un message ouvert. `telechargement` dit si les pièces jointes peuvent être récupérées par
   * le serveur pour ce profil ; sinon elles sont nommées, sans lien qui mènerait à une erreur.
   */
  let {
    message,
    dossier,
    base,
    telechargement = true,
  }: { message: MessageItem; dossier: MessageFolder; base: string; telechargement?: boolean } = $props()
</script>

<a class="pastille" href={`${base}?dossier=${dossier}`} style="margin-bottom:14px;display:inline-flex">
  Retour aux messages
</a>

<EnTete
  surtitre={message.sender}
  titre={message.subject}
  soustitre={message.date ? `${longDate(message.date)} · ${timeOf(message.date)}` : ''}
/>

{#if message.recipients.length > 0}
  <p class="discret" style="margin-bottom:14px">À : {message.recipients.join(', ')}</p>
{/if}

<article class="carte corps">{message.body || 'Ce message n’a pas de contenu lisible.'}</article>

{#if message.attachments.length > 0}
  <h2 style="margin-top:22px">Pièces jointes</h2>
  <div class="pile" style="margin-top:10px">
    {#each message.attachments as piece (piece.id)}
      {#if telechargement}
        <a
          class="carte"
          href={`/piece-jointe/${piece.source}/${piece.id}?nom=${encodeURIComponent(piece.name)}&type=${encodeURIComponent(piece.downloadType)}`}
        >{piece.name}</a>
      {:else}
        <p class="carte">{piece.name}</p>
      {/if}
    {/each}
    {#if !telechargement}
      <p class="discret">Le téléchargement des pièces jointes n’est pas encore ouvert pour ce profil.</p>
    {/if}
  </div>
{/if}

<style>
  .corps { white-space: pre-wrap; line-height: 1.65; }
</style>
