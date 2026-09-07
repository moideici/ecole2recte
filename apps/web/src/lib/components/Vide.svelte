<script lang="ts">
  let { titre, description = '' }: { titre: string; description?: string } = $props()
</script>

<div class="vide carte">
  <p style="font-weight:600">{titre}</p>
  {#if description}<p class="discret">{description}</p>{/if}
</div>

<style>
  .vide { text-align: center; padding: 32px 20px; }
</style>
