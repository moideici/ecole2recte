<script lang="ts">
  import { page } from '$app/state'
  import EnTete from '$lib/components/EnTete.svelte'
  import Actualiser from '$lib/components/Actualiser.svelte'
  import ErreurSection from '$lib/components/ErreurSection.svelte'
  import Widget from '$lib/components/Widget.svelte'
  import Vide from '$lib/components/Vide.svelte'
  import { longDate } from '@ecole2recte/protocol'
  import { FAMILLES, widget, widgetsDisponibles } from '$lib/accueil.js'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  const parent = $derived(data.profil?.parent ?? false)

  /**
   * Le panneau de personnalisation vit dans l'adresse.
   *
   * Chaque geste — cocher, monter, descendre — est un envoi de formulaire : la page se
   * réordonne donc **sans une ligne de JavaScript**, et revenir dessus après un déplacement
   * rouvre le panneau là où on l'avait laissé.
   */
  const ouvert = $derived(page.url.searchParams.get('personnaliser') === '1')

  const disponibles = $derived(widgetsDisponibles(data.profil?.modulesFermes ?? []))
  const actifs = $derived(data.disposition.map((id) => widget(id)).filter((entree) => entree !== undefined))
  const erreurs = $derived(Object.entries(data.erreurs).filter(([, valeur]) => valeur !== undefined))
</script>

<svelte:head><title>Accueil — ecole2recte</title></svelte:head>

<EnTete
  surtitre={longDate(data.jour)}
  titre={parent ? (data.profil?.nom ?? 'Accueil') : 'Bonjour'}
  soustitre={parent ? 'Vue parent' : (data.profil?.classe ?? '')}
>
  {#snippet actions()}
    <a class="pastille" href={ouvert ? '/' : '/?personnaliser=1'} aria-current={ouvert}>
      {ouvert ? 'Terminer' : 'Personnaliser'}
    </a>
    <Actualiser />
  {/snippet}
</EnTete>

{#each erreurs as [section, erreur] (section)}
  <ErreurSection message={`La section « ${section} » n’a pas pu être chargée.`} cause={erreur?.message ?? ''} />
{/each}

{#if ouvert}
  <!--
    Le choix des tuiles. Tout est dans un seul formulaire : les flèches sont des boutons
    d'envoi, donc l'ordre change sans perdre les cases cochées, et sans JavaScript.
  -->
  <form method="POST" action="?/disposition" class="panneau reglage">
    <div class="tete-panneau">
      <h2>Ce que je veux sur mon accueil</h2>
      <span class="espace"></span>
      <button class="bouton" name="reinitialiser" value="1">Remettre par défaut</button>
      <button class="bouton primaire">Enregistrer</button>
    </div>

    <div class="corps-panneau">
      <p class="discret" style="margin-bottom:12px">
        L’ordre est celui de la liste, et c’est celui du téléphone. Sur un écran large, les
        tuiles se répartissent en colonnes pour ne pas laisser de trous. Le choix reste sur
        cet appareil, et seules les sections utiles sont chargées.
      </p>

      {#if actifs.length > 0}
        <p class="minuscule">Affichés · {actifs.length}</p>
        <ol class="choisis">
          {#each actifs as entree, index (entree.id)}
            <li>
              <span class="position nombre">{index + 1}</span>
              <span class="ligne-texte">
                <span style="font-weight:600">{entree.nom}</span>
                <span class="discret">{entree.taille === 'L' ? 'pleine largeur' : entree.taille === 'M' ? 'colonne' : 'tuile'}</span>
              </span>
              <button class="fleche" name="monter" value={entree.id} disabled={index === 0} aria-label={`Monter ${entree.nom}`}>↑</button>
              <button class="fleche" name="descendre" value={entree.id} disabled={index === actifs.length - 1} aria-label={`Descendre ${entree.nom}`}>↓</button>
              <!-- Décocher puis enregistrer retire la tuile. Les flèches emportent les cases
                   telles qu'elles sont : rien ne se perd en réordonnant. -->
              <label class="garder">
                <input type="checkbox" name="actif" value={entree.id} checked />
                <span>Afficher</span>
              </label>
            </li>
          {/each}
        </ol>
      {:else}
        <p class="discret">Aucune tuile affichée. Coche ci-dessous ce que tu veux voir.</p>
      {/if}

      {#each FAMILLES as famille (famille.cle)}
        {@const dedans = disponibles.filter((entree) => entree.famille === famille.cle && !data.disposition.includes(entree.id))}
        {#if dedans.length > 0}
          <p class="minuscule" style="margin-top:16px">{famille.nom}</p>
          <p class="discret" style="font-size:0.84rem">{famille.phrase}</p>
          <div class="a-ajouter">
            {#each dedans as entree (entree.id)}
              <label class="proposition">
                <input type="checkbox" name="actif" value={entree.id} />
                <span>{entree.nom}</span>
                <span class="jeton">{entree.taille}</span>
              </label>
            {/each}
          </div>
        {/if}
      {/each}

      <p class="discret" style="margin-top:16px">
        Les tuiles d’un module que l’établissement n’a pas ouvert ne sont pas proposées.
      </p>
    </div>
  </form>
{/if}

<!--
  Le mur. En colonnes plutôt qu'en grille : une grille laisse des trous sous la tuile la plus
  courte de chaque rangée, alors que des colonnes se remplissent d'elles-mêmes. Sur téléphone,
  une seule colonne — et l'ordre est exactement celui qu'on a choisi.
-->
<div class="mur">
  {#each data.disposition as id (id)}
    <div class="tuile" class:pleine={widget(id)?.taille === 'L'}>
      <Widget {id} {data} />
    </div>
  {:else}
    <Vide
      titre="Accueil vide"
      description="Aucune tuile n’est affichée. Ouvre « Personnaliser » pour en choisir."
    />
  {/each}
</div>

<style>
  .reglage { margin-bottom: 20px; }

  .choisis { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .choisis li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 10px;
    border: 1px solid var(--bordure);
    border-radius: var(--rayon-petit);
    background: var(--surface-2);
  }
  .position {
    width: 24px;
    height: 24px;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: var(--accent-doux);
    color: var(--accent-fort);
    font-size: 0.76rem;
    font-weight: 700;
  }
  .ligne-texte { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }

  .fleche {
    width: 34px;
    height: 34px;
    flex: none;
    border-radius: var(--rayon-petit);
    border: 1px solid var(--bordure);
    background: var(--surface);
    color: var(--encre);
    font: inherit;
    cursor: pointer;
  }
  .fleche:hover:not([disabled]) { border-color: var(--accent); color: var(--accent); }
  .fleche[disabled] { opacity: 0.35; cursor: not-allowed; }

  .garder { display: inline-flex; align-items: center; gap: 6px; font-size: 0.82rem; cursor: pointer; white-space: nowrap; }

  .a-ajouter { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
  .proposition {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 40px;
    padding: 0 12px;
    border: 1px solid var(--bordure);
    border-radius: 999px;
    background: var(--surface);
    font-size: 0.88rem;
    cursor: pointer;
  }
  .proposition:hover { border-color: var(--accent); }
  .proposition:has(input:checked) { background: var(--accent-doux); border-color: var(--accent); color: var(--accent-fort); }

  /* — le mur */
  .mur { column-gap: 18px; }
  @media (min-width: 760px) { .mur { columns: 2; } }
  @media (min-width: 1240px) { .mur { columns: 3; } }

  .tuile {
    break-inside: avoid;
    -webkit-column-break-inside: avoid;
    page-break-inside: avoid;
    margin-bottom: 18px;
  }
  /* Une tuile pleine largeur coupe les colonnes : c'est ce qu'on lui demande. */
  .tuile.pleine { column-span: all; }
</style>
