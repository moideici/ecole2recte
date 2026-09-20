<script lang="ts">
  import DetailMessage from '$lib/components/DetailMessage.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
</script>

<svelte:head><title>{data.message.subject} — ecole2recte</title></svelte:head>

<DetailMessage message={data.message} dossier={data.dossier} base="/prof/messages" telechargement={false} />
