<script lang="ts">
  import EnTete from '$lib/components/EnTete.svelte'
  import { longDate, timeOf } from '@ecole2recte/protocol'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
</script>

<svelte:head><title>{data.message.subject} — ecole2recte</title></svelte:head>

<a class="pastille" href={`/messages?dossier=${data.dossier}`} style="margin-bottom:14px;display:inline-flex">
  Retour aux messages
</a>

<EnTete
  surtitre={data.message.sender}
  titre={data.message.subject}
  soustitre={data.message.date ? `${longDate(data.message.date)} · ${timeOf(data.message.date)}` : ''}
/>

{#if data.message.recipients.length > 0}
  <p class="discret" style="margin-bottom:14px">À : {data.message.recipients.join(', ')}</p>
{/if}

<article class="carte corps">{data.message.body || 'Ce message n’a pas de contenu lisible.'}</article>

{#if data.message.attachments.length > 0}
  <h2 style="margin-top:22px">Pièces jointes</h2>
  <div class="pile" style="margin-top:10px">
    {#each data.message.attachments as piece (piece.id)}
      <a
        class="carte"
        href={`/piece-jointe/${piece.source}/${piece.id}?nom=${encodeURIComponent(piece.name)}&type=${encodeURIComponent(piece.downloadType)}`}
      >{piece.name}</a>
    {/each}
  </div>
{/if}

<style>
  .corps { white-space: pre-wrap; line-height: 1.65; }
</style>
