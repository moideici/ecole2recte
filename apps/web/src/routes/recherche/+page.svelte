<script lang="ts">
  import type { PageData } from './$types'
  import EnTete from '$lib/components/EnTete.svelte'
  let { data }: { data: PageData } = $props()
  const groupes = [
    { type: 'devoir', titre: 'Devoirs' },
    { type: 'message', titre: 'Messages' },
    { type: 'note', titre: 'Notes' },
  ] as const
</script>

<svelte:head><title>Recherche — ecole2recte</title></svelte:head>
<EnTete titre="Recherche" soustitre="Devoirs, messages reçus et notes" />
<form method="GET" class="rangee">
  <label>Rechercher <input class="champ" type="search" name="q" value={data.q} /></label>
  <button class="bouton">Rechercher</button>
</form>
<p class="discret">La recherche porte sur les dix journées de devoirs chargées, la première page des messages reçus et les notes disponibles. Au maximum 50 résultats.</p>
{#each data.erreurs as erreur}<p role="alert">Chargement incomplet : {erreur}</p>{/each}
{#if data.resultats.length === 0}
  <p>Aucun résultat</p>
{:else}
  {#each groupes as groupe}
    {@const resultats = data.resultats.filter((resultat) => resultat.type === groupe.type)}
    {#if resultats.length > 0}
      <section class="panneau">
        <h2>{groupe.titre}</h2>
        <ul>
          {#each resultats as resultat}
            <li><a href={resultat.href}>{resultat.titre}</a><p>{resultat.detail}</p></li>
          {/each}
        </ul>
      </section>
    {/if}
  {/each}
{/if}
