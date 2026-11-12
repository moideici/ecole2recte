<script lang="ts">
  import type { Lesson } from '@ecole2recte/protocol'
  import { timeOf } from '@ecole2recte/protocol'
  import { couleurMatiere } from '$lib/matiereCouleur.js'
  import ModificationCours from './ModificationCours.svelte'

  /** `href` rend le cours cliquable : il mène à sa journée, contenu de séance compris. */
  let { cours, actuel = false, href = '' }: { cours: Lesson; actuel?: boolean; href?: string } = $props()
  const couleur = $derived(couleurMatiere(cours.subject))
</script>

<svelte:element
  this={href ? 'a' : 'article'}
  href={href || undefined}
  class="cours"
  class:lien={href !== ''}
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
    <ModificationCours {cours} />
    {#if cours.canceled}
      <!-- Un cours annulé reste affiché : l'effacer ferait croire à un trou dans la journée. -->
      <p class="jeton erreur-jeton">Annulé</p>
    {:else if cours.exam}
      <p class="jeton alerte">Évaluation</p>
    {/if}
  </div>
  {#if href}<span class="chevron" aria-hidden="true">›</span>{/if}
</svelte:element>

<style>
  .cours {
    display: flex;
    gap: 12px;
    align-items: stretch;
    background: var(--fond-matiere);
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
  .lien { text-decoration: none; color: inherit; }
  .lien:hover { border-color: var(--encre-matiere); background: var(--surface-2); }
  .chevron { align-self: center; color: var(--encre-douce); font-size: 1.3rem; flex: none; }
  .titre { font-weight: 650; color: var(--encre-matiere); }
  .detail { color: inherit; font-size: 0.86rem; }
  .cours { color: var(--encre-matiere); }
  .jeton { margin-top: 4px; }

  .cours.annule { color: var(--encre-douce); background: var(--surface-2); border-left-color: var(--erreur); }
  .annule .titre { color: var(--encre-douce); }
  .annule .titre { text-decoration: line-through; }

  /* L'encadrement distingue le cours actuel sans dépendre de la seule couleur. */
  .actuel { box-shadow: inset 0 0 0 2px var(--encre-matiere); }
  .actuel .titre, .actuel .debut { color: var(--encre-matiere); }
  .actuel .detail, .actuel .fin { color: color-mix(in srgb, var(--encre-matiere) 75%, transparent); }
</style>
