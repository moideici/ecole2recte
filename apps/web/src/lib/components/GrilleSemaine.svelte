<script lang="ts">
  import type { Lesson } from '@ecole2recte/protocol'
  import { shortDate, timeOf } from '@ecole2recte/protocol'
  import { couleurMatiere } from '$lib/matiereCouleur.js'

  /**
   * La grille d'une semaine : les journées en colonnes, les heures en lignes.
   *
   * C'est la forme qu'on lit sans réfléchir — un trou se voit, une journée chargée se voit,
   * et deux cours à la même heure ne se cachent pas l'un l'autre. Elle sert l'élève et le
   * professeur : la dupliquer garantirait qu'elles divergent un jour.
   */
  let {
    jours,
    debut,
    fin,
    aujourdhui,
    lien,
    mention,
    titre,
    teinte,
    lienCours,
  }: {
    jours: Array<{ date: string; lecons: Lesson[] }>
    /** Bornes de la grille, en minutes depuis minuit. */
    debut: number
    fin: number
    aujourdhui: string
    /** L'adresse d'une journée, pour ouvrir le détail depuis son en-tête. */
    lien: (date: string) => string
    /** Une mention à poser sur un cours — « À rendre », par exemple. */
    mention?: (date: string, cours: Lesson) => string
    /**
     * Ce qui identifie un cours en gros, et ce qui lui donne sa couleur.
     *
     * Un élève reconnaît sa journée à la matière. Un professeur de mathématiques, lui, n'a
     * qu'une matière : ce qui distingue ses heures, c'est la classe. Le composant ne le
     * devine pas, la page le dit.
     */
    titre?: (cours: Lesson) => string
    teinte?: (cours: Lesson) => string
    /** Où mène un cours quand on clique dessus — sa journée, par défaut. */
    lienCours?: (date: string, cours: Lesson) => string
  } = $props()

  const NOMS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
  const HAUTEUR_HEURE = 56

  function minutes(instant: string): number {
    return Number(instant.slice(11, 13)) * 60 + Number(instant.slice(14, 16))
  }

  function nomDe(date: string): string {
    return NOMS[(new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7] as string
  }

  const heures = $derived(
    Array.from({ length: Math.max(1, (fin - debut) / 60) }, (_, index) => debut + index * 60),
  )

  /**
   * Les cours d'une journée, placés et répartis en colonnes.
   *
   * Deux cours à la même heure ne sont pas un doublon : c'est une classe scindée en groupes.
   * Les superposer en cacherait un ; ils se partagent donc la largeur de la journée.
   */
  function placer(lecons: Lesson[]) {
    const ordonnes = [...lecons].sort((gauche, droite) => gauche.start.localeCompare(droite.start))
    const colonnes: Lesson[][] = []
    const place = new Map<string, number>()
    for (const cours of ordonnes) {
      let index = colonnes.findIndex((colonne) => minutes((colonne[colonne.length - 1] as Lesson).end) <= minutes(cours.start))
      if (index === -1) {
        colonnes.push([cours])
        index = colonnes.length - 1
      } else {
        ;(colonnes[index] as Lesson[]).push(cours)
      }
      place.set(cours.id, index)
    }
    const largeur = Math.max(1, colonnes.length)
    return ordonnes.map((cours) => ({
      cours,
      haut: ((minutes(cours.start) - debut) / 60) * HAUTEUR_HEURE,
      hauteur: Math.max(28, ((minutes(cours.end) - minutes(cours.start)) / 60) * HAUTEUR_HEURE - 3),
      colonne: place.get(cours.id) ?? 0,
      colonnes: largeur,
    }))
  }
</script>

<div class="enveloppe-large">
  <div class="grille" style={`--hauteur:${heures.length * HAUTEUR_HEURE}px`}>
    <div class="gouttiere">
      <div class="coin"></div>
      {#each heures as heure (heure)}
        <div class="heure-graduee"><span>{String(Math.floor(heure / 60)).padStart(2, '0')} h</span></div>
      {/each}
    </div>

    {#each jours as journee (journee.date)}
      <div class="colonne" class:aujourdhui={journee.date === aujourdhui}>
        <a class="tete-jour" href={lien(journee.date)}>
          <span class="nom-jour">{nomDe(journee.date)}</span>
          <span class="date-jour">{shortDate(journee.date)}</span>
        </a>
        <div class="piste">
          {#each heures as heure, rang (heure)}
            <div class="trait" style={`top:${rang * HAUTEUR_HEURE}px`}></div>
          {/each}

          {#each placer(journee.lecons) as bloc (bloc.cours.id)}
            {@const couleur = couleurMatiere(teinte?.(bloc.cours) ?? bloc.cours.subject)}
            {@const marque = mention?.(journee.date, bloc.cours) ?? ''}
            <a
              class="bloc"
              class:annule={bloc.cours.canceled}
              href={lienCours?.(journee.date, bloc.cours) ?? lien(journee.date)}
              style={`top:${bloc.haut}px;height:${bloc.hauteur}px;left:calc(${(bloc.colonne * 100) / bloc.colonnes}% + 2px);width:calc(${100 / bloc.colonnes}% - 4px);--fond-matiere:${couleur.fond};--encre-matiere:${couleur.encre}`}
            >
              <p class="bloc-heure">{timeOf(bloc.cours.start)}</p>
              <p class="bloc-matiere">{titre?.(bloc.cours) || bloc.cours.subject || 'Cours'}</p>
              <!-- Le groupe ne se répète pas quand c'est déjà lui qui titre le bloc. -->
              <p class="bloc-detail">
                {(titre ? [bloc.cours.room] : [bloc.cours.room, bloc.cours.group]).filter(Boolean).join(' · ')}
              </p>
              {#if bloc.cours.canceled}
                <p class="bloc-mention">Annulé</p>
              {:else if bloc.cours.exam}
                <p class="bloc-mention">Évaluation</p>
              {:else if marque}
                <p class="bloc-mention">{marque}</p>
              {/if}
            </a>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .grille { display: flex; min-width: 640px; }

  .gouttiere { flex: none; width: 46px; }
  .coin { height: 46px; border-bottom: 1px solid var(--bordure); }
  .heure-graduee {
    height: 56px;
    font-size: 0.72rem;
    color: var(--encre-douce);
    text-align: right;
    padding-right: 6px;
  }
  .heure-graduee span { position: relative; top: -7px; }

  .colonne { flex: 1; min-width: 0; border-left: 1px solid var(--bordure-douce); }
  .colonne.aujourdhui { background: var(--accent-doux); }

  .tete-jour {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 46px;
    border-bottom: 1px solid var(--bordure);
    text-decoration: none;
    color: var(--encre);
    line-height: 1.1;
  }
  .tete-jour:hover { background: var(--surface-2); }
  .nom-jour { font-weight: 650; font-size: 0.85rem; }
  .date-jour { font-size: 0.72rem; color: var(--encre-douce); }

  .piste { position: relative; height: var(--hauteur); }
  .trait { position: absolute; left: 0; right: 0; height: 1px; background: var(--bordure-douce); }

  .bloc {
    position: absolute;
    display: block;
    overflow: hidden;
    padding: 4px 6px;
    border-radius: var(--rayon-petit);
    border-left: 4px solid var(--encre-matiere);
    background: var(--fond-matiere);
    color: var(--encre-matiere);
    font-size: 0.76rem;
    line-height: 1.2;
    text-decoration: none;
  }
  .bloc:hover { filter: brightness(0.96); box-shadow: inset 0 0 0 1px var(--encre-matiere); }
  .bloc-heure { font-variant-numeric: tabular-nums; font-size: 0.7rem; opacity: 0.85; }
  .bloc-matiere { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bloc-detail { opacity: 0.85; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bloc-mention { font-weight: 700; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.04em; }

  /* Un cours annulé reste affiché, barré : l'effacer ferait croire à un trou dans la journée. */
  .annule { background: var(--surface-2); color: var(--encre-douce); border-left-color: var(--erreur); }
  .annule .bloc-matiere { text-decoration: line-through; }
  .annule .bloc-mention { color: var(--erreur); }
</style>
