<script lang="ts">
  import ListeMessages from '$lib/components/ListeMessages.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
</script>

<svelte:head><title>Messages — ecole2recte</title></svelte:head>

<ListeMessages
  messages={data.messages}
  dossier={data.dossier}
  page={data.page}
  jour={data.jour}
  base="/prof/messages"
  erreur={data.erreur}
/>
