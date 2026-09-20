<script lang="ts">
  import EnTete from '$lib/components/EnTete.svelte'
  import Vide from '$lib/components/Vide.svelte'
  import ErreurSection from '$lib/components/ErreurSection.svelte'
  import { matches } from '@ecole2recte/protocol'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  let recherche = $state('')

  const visibles = $derived(data.eleves.filter((eleve) => matches(recherche, eleve.lastName, eleve.firstName, eleve.className)))
  const groupe = $derived(data.groupe.type === 'G')
  const resume = $derived(
    [
      `${data.eleves.length} élève${data.eleves.length > 1 ? 's' : ''}`,
      `${data.effectifs.filles} fille${data.effectifs.filles > 1 ? 's' : ''}`,
      `${data.effectifs.garcons} garçon${data.effectifs.garcons > 1 ? 's' : ''}`,
    ].join(' · '),
  )
</script>

<svelte:head><title>{data.groupe.libelle} — ecole2recte</title></svelte:head>

<a class="pastille" href="/prof/classes" style="margin-bottom:14px;display:inline-flex">Toutes les classes</a>

<EnTete
  surtitre={`${groupe ? 'Groupe' : 'Classe'}${data.groupe.pp ? ' · professeur principal' : ''}`}
  titre={data.groupe.libelle}
  soustitre={resume}
/>

{#if data.erreur}
  <ErreurSection message="La liste des élèves n’a pas pu être chargée." cause={data.erreur} />
{/if}

<div class="rangee" style="flex-wrap:wrap;gap:8px;margin-bottom:14px">
  {#if data.groupe.notee}<a class="pastille" href={`/prof/notes?groupe=${data.groupe.cle}`}>Notes</a>{/if}
  <a class="pastille" href={`/prof/cahier-de-textes?groupe=${data.groupe.cle}`}>Cahier de textes</a>
  {#if data.effectifs.accompagnes > 0}
    <span class="discret">{data.effectifs.accompagnes} avec un dispositif d’accompagnement</span>
  {/if}
</div>

{#if data.eleves.length > 0}
  <label class="pile" style="gap:6px;margin-bottom:12px">
    <span class="minuscule">Rechercher</span>
    <input class="champ" type="search" bind:value={recherche} placeholder="Un nom, un prénom…" />
  </label>

  <div class="enveloppe-large carte" style="padding:0">
    <table class="tableau">
      <thead>
        <tr>
          <th scope="col">Nom</th>
          <th scope="col">Prénom</th>
          {#if groupe}<th scope="col">Classe</th>{/if}
          <th scope="col">Régime</th>
          <th scope="col">Accompagnement</th>
        </tr>
      </thead>
      <tbody>
        {#each visibles as eleve (eleve.id)}
          <tr>
            <td class="nom">{eleve.lastName}</td>
            <td>{eleve.firstName}</td>
            {#if groupe}<td>{eleve.className || '—'}</td>{/if}
            <td>{eleve.regime || '—'}</td>
            <td>{[...eleve.supports, eleve.dispensed ? 'Dispense' : ''].filter(Boolean).join(' · ') || '—'}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  {#if visibles.length === 0}
    <Vide titre="Aucun résultat" description="Aucun élève ne correspond à cette recherche." />
  {/if}
{:else if !data.erreur}
  <Vide titre="Aucun élève" description="Le service ne rend aucun élève pour cette classe." />
{/if}

<p class="discret" style="margin-top:14px">
  Les photos ne sont pas affichées : leur téléchargement n’est documenté nulle part, et elles
  ne transiteront pas par ce serveur avant d’avoir été vérifiées avec un professeur.
  {#if data.effectifs.partis > 0}{data.effectifs.partis} élève{data.effectifs.partis > 1 ? 's partis ne sont' : ' parti n’est'} plus listé{data.effectifs.partis > 1 ? 's' : ''}.{/if}
</p>

<style>
  .nom { font-weight: 600; }
</style>
