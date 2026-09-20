<script lang="ts">
  import type { Lesson } from '@ecole2recte/protocol'
  import { timeOf } from '@ecole2recte/protocol'
  import { couleurMatiere } from '$lib/matiereCouleur.js'

  let { cours, actuel = false }: { cours: Lesson; actuel?: boolean } = $props()
  const couleur = $derived(couleurMatiere(cours.subject))
</script>

<article
  class="cours carte"
  class:actuel
  class:annule={cours.canceled}
  style={cours.canceled ? '' : `--fond-matiere:${couleur.fond};--encre-matiere:${couleur.encre}`}
>
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
  .cours {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    background: var(--fond-matiere, var(--surface));
    border-color: color-mix(in srgb, var(--encre-matiere, var(--bordure)) 35%, var(--bordure));
  }
  .cours, .heure, .titre { color: var(--encre-matiere, var(--encre)); }
  .heure { font-variant-numeric: tabular-nums; font-weight: 600; min-width: 5.2rem; }
  .titre { font-weight: 600; }
  .annule .titre { text-decoration: line-through; opacity: 0.7; }
  .actuel { box-shadow: inset 3px 0 0 var(--encre-matiere, var(--accent)), var(--ombre); }
  .marque { font-size: 0.78rem; font-weight: 650; color: var(--alerte); margin-top: 2px; }
  .marque.annulee { color: var(--erreur); }
</style>
