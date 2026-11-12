<script lang="ts">
  import type { Lesson } from '@ecole2recte/protocol'
  import { timeOf } from '@ecole2recte/protocol'
  let { cours }: { cours: Lesson } = $props()
</script>

{#if cours.previousStart || cours.previousRoom}
  <p class="modification">
    <strong>{cours.previousStart ? 'Déplacé' : 'Modifié'}</strong>
    {#if cours.previousStart}<del>{timeOf(cours.previousStart)}</del> → {timeOf(cours.start)}{/if}
    {#if cours.previousRoom}<del>{cours.previousRoom}</del> → {cours.room}{/if}
  </p>
{:else if cours.note}
  <p class="modification">{cours.note}</p>
{/if}

<style>
  .modification { font-size: 0.75rem; line-height: 1.3; }
  del { text-decoration-thickness: 2px; }
</style>
