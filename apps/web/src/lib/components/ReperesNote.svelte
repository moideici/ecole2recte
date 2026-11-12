<script lang="ts">
  import { classDelta, type Grade } from '@ecole2recte/protocol'
  let { note }: { note: Grade } = $props()
  const delta = $derived(classDelta(note))
  const nombre = (value: number) => value.toFixed(2).replace('.', ',')
</script>

{#if note.classAverage !== undefined}<p class="discret">Classe {nombre(note.classAverage)}/{note.scale}</p>{/if}
{#if delta !== undefined}<p class="discret">Écart {delta > 0 ? '+' : ''}{nombre(delta)} point{Math.abs(delta) === 1 ? '' : 's'}</p>{/if}
{#if note.minimum !== undefined}<p class="discret">Minimum {nombre(note.minimum)}/{note.scale}</p>{/if}
{#if note.maximum !== undefined}<p class="discret">Maximum {nombre(note.maximum)}/{note.scale}</p>{/if}
