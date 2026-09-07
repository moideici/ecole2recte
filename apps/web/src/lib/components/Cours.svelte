<script lang="ts">
  import type { Lesson } from '@ecole2recte/protocol'
  import { timeOf } from '@ecole2recte/protocol'

  let { cours, actuel = false }: { cours: Lesson; actuel?: boolean } = $props()
</script>

<article class="cours carte" class:actuel class:annule={cours.canceled}>
  <p class="heure">{timeOf(cours.start)}<span class="discret"> – {timeOf(cours.end)}</span></p>
  <div style="flex:1;min-width:0">
    <p class="titre">{cours.subject || 'Cours'}</p>
    <p class="discret">
      {[cours.room, cours.teacher, cours.group].filter(Boolean).join(' · ')}
    </p>
    {#if cours.canceled}
      <!-- Un cours annulé reste affiché : l'effacer ferait croire à un trou dans la journée. -->
      <p class="marque annulee">Annulé</p>
    {:else if cours.exam}
      <p class="marque">Évaluation</p>
    {/if}
  </div>
</article>

<style>
  .cours { display: flex; gap: 14px; align-items: flex-start; }
  .heure { font-variant-numeric: tabular-nums; font-weight: 600; min-width: 5.2rem; }
  .titre { font-weight: 600; }
  .annule .titre { text-decoration: line-through; opacity: 0.7; }
  .actuel { border-color: var(--accent); box-shadow: inset 3px 0 0 var(--accent), var(--ombre); }
  .marque { font-size: 0.78rem; font-weight: 650; color: var(--alerte); margin-top: 2px; }
  .marque.annulee { color: var(--erreur); }
</style>
