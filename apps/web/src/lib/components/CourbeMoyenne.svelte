<script lang="ts">
  import { shortDate, type AveragePoint } from '@ecole2recte/protocol'
  let { points }: { points: AveragePoint[] } = $props()
  const nombre = (value: number) => value.toFixed(2).replace('.', ',')
  const x = (index: number) => points.length === 1 ? 160 : 12 + index * 296 / (points.length - 1)
  const y = (value: number) => 96 - Math.min(20, Math.max(0, value)) * 4
</script>

<figure>
  <figcaption>Évolution · calculée par l’appli, sur 20</figcaption>
  {#if points.length > 0}
    <svg viewBox="0 0 320 108" role="img" aria-label="Évolution de la moyenne cumulée sur 20">
      <path d="M12 16V96H308 M12 56H308" fill="none" stroke="var(--bordure)" />
      <polyline points={points.map((point, index) => `${x(index)},${y(point.value)}`).join(' ')} fill="none" stroke="var(--accent)" stroke-width="2" />
      {#each points as point, index}
        <circle cx={x(index)} cy={y(point.value)} r="3" fill="var(--accent)"><title>{shortDate(point.date)} : {nombre(point.value)}/20</title></circle>
      {/each}
    </svg>
    <p class="discret">{points.length} point{points.length > 1 ? 's' : ''} : {nombre(points[0]!.value)}/20 le {shortDate(points[0]!.date)}, puis {nombre(points[points.length - 1]!.value)}/20 le {shortDate(points[points.length - 1]!.date)}.</p>
  {:else}
    <p class="discret">Pas de note chiffrée et datée pour tracer une évolution.</p>
  {/if}
</figure>

<style>
  figure { margin: 14px 0; }
  figcaption, p { font-size: 0.82rem; }
  svg { display: block; width: 100%; max-width: 600px; height: auto; }
</style>
