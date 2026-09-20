<script lang="ts">
  import type { Lesson } from '@ecole2recte/protocol'
  import { timeOf } from '@ecole2recte/protocol'
  import { couleurMatiere } from '$lib/matiereCouleur.js'

  let { cours, actuel = false }: { cours: Lesson; actuel?: boolean } = $props()
  const couleur = $derived(couleurMatiere(cours.subject))
</script>

<article
  class="cours"
  class:actuel
  class:annule={cours.canceled}
  style={`--fond-matiere:${couleur.fond};--encre-matiere:${couleur.encre}`}
>
  <p class="heure">
    <span class="debut">{timeOf(cours.start)}</span>
    <span class="fin">{timeOf(cours.end)}</span>
  </p>
  <div class="corps">
    <p class="titre">{cours.subject || 'Cours'}</p>
    <p class="detail">{[cours.room, cours.teacher, cours.group].filter(Boolean).join(' · ')}</p>
    {#if cours.canceled}
      <!-- Un cours annulé reste affiché : l'effacer ferait croire à un trou dans la journée. -->
      <p class="jeton erreur-jeton">Annulé</p>
    {:else if cours.exam}
      <p class="jeton alerte">Évaluation</p>
    {/if}
  </div>
</article>

<style>
  .cours {
    display: flex;
    gap: 12px;
    align-items: stretch;
    background: var(--surface);
    border: 1px solid var(--bordure);
    border-left: 5px solid var(--encre-matiere);
    border-radius: var(--rayon-petit);
    box-shadow: var(--ombre);
    padding: 10px 12px;
  }
  .heure {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 3.6rem;
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
  }
  .debut { font-weight: 700; font-size: 0.98rem; }
  .fin { color: var(--encre-douce); font-size: 0.82rem; }
  .corps { flex: 1; min-width: 0; }
  .titre { font-weight: 650; color: var(--encre); }
  .detail { color: var(--encre-douce); font-size: 0.86rem; }
  .jeton { margin-top: 4px; }

  .annule { opacity: 0.75; background: var(--surface-2); border-left-color: var(--erreur); }
  .annule .titre { text-decoration: line-through; }

  /* Le cours en train de se dérouler est le seul teinté : on le repère sans le chercher. */
  .actuel { background: var(--fond-matiere); }
  .actuel .titre, .actuel .debut { color: var(--encre-matiere); }
  .actuel .detail, .actuel .fin { color: color-mix(in srgb, var(--encre-matiere) 75%, transparent); }
</style>
