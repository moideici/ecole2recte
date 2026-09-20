<script lang="ts">
  import type { Lesson } from '@ecole2recte/protocol'
  import { timeOf } from '@ecole2recte/protocol'
  import { couleurMatiere } from '$lib/matiereCouleur.js'

  /**
   * Une journée, à l'échelle du temps.
   *
   * Une liste met toutes les heures à la même hauteur : un cours de deux heures y ressemble
   * à un cours d'une heure, et un trou ne se voit pas du tout. Ici **la hauteur est la
   * durée** — un creux se lit comme un creux, et l'heure qu'il est se lit d'un coup d'œil.
   */
  let {
    cours,
    debut,
    fin,
    maintenant = null,
    lien = '',
  }: {
    cours: Lesson[]
    /** Bornes de la journée, en minutes depuis minuit. */
    debut: number
    fin: number
    /** L'instant courant `2026-09-21T10:35:00`, ou `null` si ce n'est pas aujourd'hui. */
    maintenant?: string | null
    /** Où mène un cours quand on clique dessus. */
    lien?: string
  } = $props()

  /** La hauteur d'une heure. Un seul nombre : la gouttière le suit par variable CSS. */
  const PX_HEURE = 34
  /** En deçà, c'est une intercours et non une permanence — la même règle que `gaps()`. */
  const CREUX_MINIMAL = 30

  function minutes(instant: string): number {
    return Number(instant.slice(11, 13)) * 60 + Number(instant.slice(14, 16))
  }
  const y = (min: number) => ((min - debut) / 60) * PX_HEURE

  const heures = $derived(
    Array.from({ length: Math.max(1, Math.round((fin - debut) / 60)) }, (_, index) => debut + index * 60),
  )

  const ordonnes = $derived([...cours].sort((gauche, droite) => gauche.start.localeCompare(droite.start)))

  /** Les vrais creux de la journée, dessinés pour qu'ils se voient. */
  const creux = $derived.by(() => {
    const actifs = ordonnes.filter((entree) => !entree.canceled)
    const trouves: Array<{ debut: number; fin: number; minutes: number }> = []
    for (let index = 1; index < actifs.length; index += 1) {
      const avant = minutes((actifs[index - 1] as Lesson).end)
      const apres = minutes((actifs[index] as Lesson).start)
      if (apres - avant > CREUX_MINIMAL) trouves.push({ debut: avant, fin: apres, minutes: apres - avant })
    }
    return trouves
  })

  const instant = $derived(maintenant === null ? null : minutes(maintenant))
  const dansLaJournee = $derived(instant !== null && instant >= debut && instant <= fin)
</script>

<div class="journee" style={`--px-heure:${PX_HEURE}px`}>
  <div class="gouttiere" aria-hidden="true">
    {#each heures as heure (heure)}
      <div>{String(Math.floor(heure / 60)).padStart(2, '0')} h</div>
    {/each}
  </div>

  <div class="piste" style={`height:${((fin - debut) / 60) * PX_HEURE}px`}>
    {#each heures as heure (heure)}
      <div class="trait" style={`top:${y(heure)}px`}></div>
    {/each}

    {#each creux as trou (trou.debut)}
      <div class="creux" style={`top:${y(trou.debut)}px;height:${y(trou.fin) - y(trou.debut) - 3}px`}>
        {trou.minutes >= 60 ? `${Math.floor(trou.minutes / 60)} h ${trou.minutes % 60 || ''}`.trim() : `${trou.minutes} min`} libres
      </div>
    {/each}

    {#each ordonnes as cours (cours.id)}
      {@const couleur = couleurMatiere(cours.subject)}
      {@const ici = instant !== null && minutes(cours.start) <= instant && minutes(cours.end) > instant && !cours.canceled}
      <svelte:element
        this={lien ? 'a' : 'div'}
        href={lien || undefined}
        class="bloc"
        class:ici
        class:annule={cours.canceled}
        style={`top:${y(minutes(cours.start))}px;height:${y(minutes(cours.end)) - y(minutes(cours.start)) - 3}px;--fond-matiere:${couleur.fond};--encre-matiere:${couleur.encre}`}
      >
        <b>{cours.subject || 'Cours'}</b>
        <span>{timeOf(cours.start)}{cours.room ? ` · ${cours.room}` : ''}{cours.group ? ` · ${cours.group}` : ''}</span>
      </svelte:element>
    {/each}

    {#if dansLaJournee && instant !== null}
      <!-- Le trait passe derrière les cours : il marque l'heure sans barrer celui qui se
           déroule, dont l'encadré dit déjà qu'il est le bon. -->
      <div class="maintenant" style={`top:${y(instant)}px`} role="img" aria-label={`Il est ${timeOf(maintenant as string)}`}></div>
    {/if}
  </div>
</div>

<style>
  .journee { display: flex; }

  .gouttiere { width: 34px; flex: none; }
  .gouttiere div {
    height: var(--px-heure);
    font-size: 0.68rem;
    font-variant-numeric: tabular-nums;
    color: var(--encre-douce);
    text-align: right;
    padding-right: 6px;
  }

  .piste { position: relative; flex: 1; min-width: 0; border-left: 1px solid var(--bordure-douce); }
  .trait { position: absolute; left: 0; right: 0; height: 1px; background: var(--bordure-douce); }

  .bloc {
    position: absolute;
    z-index: 1;
    left: 4px;
    right: 0;
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 7px;
    padding: 3px 8px;
    overflow: hidden;
    border-radius: 5px;
    border-left: 4px solid var(--encre-matiere);
    background: var(--fond-matiere);
    color: var(--encre-matiere);
    text-decoration: none;
  }
  .bloc b { font-size: 0.82rem; font-weight: 700; }
  .bloc span { font-size: 0.74rem; opacity: 0.85; font-variant-numeric: tabular-nums; }
  .bloc.ici { box-shadow: 0 0 0 2px var(--encre) inset; }
  a.bloc:hover { filter: brightness(0.96); }

  /* Un cours annulé reste affiché, barré : l'effacer ferait croire à un trou. */
  .annule { background: var(--surface-2); color: var(--encre-douce); border-left-color: var(--erreur); }
  .annule b { text-decoration: line-through; }

  .creux {
    position: absolute;
    z-index: 1;
    left: 4px;
    right: 0;
    display: grid;
    place-items: center;
    font-size: 0.68rem;
    font-variant-numeric: tabular-nums;
    color: var(--encre-douce);
    border: 1px dashed var(--bordure);
    border-radius: 5px;
  }

  .maintenant {
    position: absolute;
    z-index: 0;
    left: -9px;
    right: 0;
    height: 2px;
    background: var(--erreur);
    opacity: 0.75;
  }
  .maintenant::before {
    content: '';
    position: absolute;
    left: 0;
    top: -3px;
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--erreur);
  }
</style>
