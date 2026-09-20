<script lang="ts">
  import EnTete from '$lib/components/EnTete.svelte'
  import Vide from '$lib/components/Vide.svelte'
  import ErreurSection from '$lib/components/ErreurSection.svelte'
  import { matches, shortDate } from '@ecole2recte/protocol'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  let recherche = $state('')

  const lignes = $derived((data.grille?.lignes ?? []).filter((ligne) => matches(recherche, ligne.nom, ligne.prenom)))
  const avecClasse = $derived(data.selection.groupe.startsWith('G-'))

  /** Un nombre à la française, ou un tiret quand il n'y a rien à calculer. */
  function chiffre(valeur: number | null | undefined, decimales = 2): string {
    if (valeur === null || valeur === undefined) return '—'
    return valeur.toFixed(decimales).replace('.', ',')
  }

  function coefficient(valeur: number): string {
    return Number.isInteger(valeur) ? String(valeur) : chiffre(valeur, 1)
  }

  // Changer de classe ou de période recharge la page : les choix suivants en dépendent.
  function envoyer(event: Event) {
    ;(event.currentTarget as HTMLSelectElement).form?.requestSubmit()
  }
</script>

<svelte:head><title>Notes — ecole2recte</title></svelte:head>

<EnTete surtitre="Carnet de notes · lecture seule" titre={data.selection.libelle || 'Notes'} />

{#if data.erreur}
  <ErreurSection message="Les notes n’ont pas pu être chargées." cause={data.erreur} />
{/if}

{#if data.groupes.length === 0}
  {#if !data.erreur}
    <Vide titre="Aucune grille de notes" description="Le catalogue ne déclare aucune classe avec une matière notée." />
  {/if}
{:else}
  <form method="GET" class="choix">
    <label class="pile" style="gap:6px">
      <span class="minuscule">Classe ou groupe</span>
      <select class="champ" name="groupe" onchange={envoyer}>
        {#each data.groupes as groupe (groupe.cle)}
          <option value={groupe.cle} selected={groupe.cle === data.selection.groupe}>{groupe.libelle}</option>
        {/each}
      </select>
    </label>
    <label class="pile" style="gap:6px">
      <span class="minuscule">Période</span>
      <select class="champ" name="periode" onchange={envoyer}>
        {#each data.periodes as periode (periode.code)}
          <option value={periode.code} selected={periode.code === data.selection.periode}>
            {periode.libelle}{periode.ouverte ? '' : ' (close)'}
          </option>
        {/each}
      </select>
    </label>
    <label class="pile" style="gap:6px">
      <span class="minuscule">Matière</span>
      <select class="champ" name="matiere" onchange={envoyer}>
        {#each data.matieres as matiere (matiere.code)}
          <option value={matiere.code} selected={matiere.code === data.selection.matiere}>{matiere.libelle}</option>
        {/each}
      </select>
    </label>
    <button class="bouton">Afficher</button>
  </form>

  {#if data.grille}
    {#if data.grille.evaluations.length === 0}
      <Vide titre="Aucune évaluation" description="Rien n’est encore noté pour cette période." />
    {:else}
      <div class="rangee outils">
        <label class="pile" style="gap:6px;flex:1;min-width:220px">
          <span class="minuscule">Rechercher un élève</span>
          <input class="champ" type="search" bind:value={recherche} />
        </label>
        <p class="discret estimation">
          Moyennes calculées à partir de cette grille, sans les évaluations qui ne comptent pas :
          celles du bulletin peuvent différer.
        </p>
      </div>

      <div class="enveloppe-large panneau">
        <table class="tableau grille">
          <thead>
            <tr>
              <th scope="col" class="eleve">Élève</th>
              {#each data.grille.evaluations as evaluation (evaluation.id)}
                <th scope="col" class="colonne" class:ecartee={!evaluation.compte}>
                  <span class="titre">{evaluation.libelle}</span>
                  <span class="detail">{evaluation.date ? shortDate(evaluation.date) : ''}</span>
                  <span class="detail">/{evaluation.bareme} · coef {coefficient(evaluation.coefficient)}</span>
                  {#if !evaluation.compte}<span class="detail">ne compte pas</span>{/if}
                </th>
              {/each}
              <th scope="col" class="colonne">Moyenne<span class="detail">calculée, sur 20</span></th>
            </tr>
          </thead>
          <tbody>
            {#each lignes as ligne (ligne.id)}
              <tr>
                <th scope="row" class="eleve">
                  {ligne.nom} {ligne.prenom}
                  {#if avecClasse && ligne.classe}<span class="detail">{ligne.classe}</span>{/if}
                </th>
                {#each ligne.notes as note, index (index)}
                  <td
                    class="note"
                    class:ecartee={data.grille.evaluations[index]?.compte === false}
                    title={note?.commentaire || undefined}
                  >
                    {note?.ecrit ?? ''}{#if note?.commentaire}<span class="commentaire">*</span>{/if}
                  </td>
                {/each}
                <td class="note moyenne">{chiffre(ligne.moyenne)}</td>
              </tr>
            {/each}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" class="eleve">Moyenne de l’évaluation</th>
              {#each data.grille.evaluations as evaluation (evaluation.id)}
                <td class="note">{chiffre(evaluation.moyenne)}</td>
              {/each}
              <td class="note moyenne">{chiffre(data.grille.moyenne)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {#if lignes.length === 0}
        <Vide titre="Aucun résultat" description="Aucun élève ne correspond à cette recherche." />
      {/if}
      <p class="discret" style="margin-top:10px">Une astérisque signale un commentaire : il s’affiche au survol de la note.</p>
    {/if}
  {/if}
{/if}

<style>
  .choix { display: grid; gap: 10px; grid-template-columns: 1fr; align-items: end; margin-bottom: 8px; }
  @media (min-width: 760px) { .choix { grid-template-columns: 2fr 1.4fr 1.4fr auto; } }
  .outils { flex-wrap: wrap; align-items: flex-end; margin: 14px 0 10px; }
  .estimation { max-width: 440px; }
  .grille th, .grille td { white-space: nowrap; }
  .grille .eleve { position: sticky; left: 0; z-index: 1; background: var(--surface); text-align: left; color: var(--encre); font-weight: 550; font-size: 0.94rem; }
  .grille .colonne { text-align: center; vertical-align: bottom; }
  .grille .titre { display: block; color: var(--encre); font-weight: 600; }
  .grille .detail { display: block; font-weight: 400; color: var(--encre-douce); font-size: 0.78rem; }
  .grille .note { text-align: center; font-variant-numeric: tabular-nums; }
  .grille .moyenne { font-weight: 650; }
  .grille .ecartee { opacity: 0.6; }
  .grille tfoot th, .grille tfoot td { border-top: 2px solid var(--bordure); }
  .commentaire { color: var(--accent); margin-left: 2px; }
</style>
