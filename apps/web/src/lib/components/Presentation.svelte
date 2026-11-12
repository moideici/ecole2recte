<script lang="ts">
  import { onMount } from 'svelte'

  /*
   * Trois pages au premier lancement. Passable à tout moment, mémorisée une fois vue ou
   * passée ; « Revoir la présentation » dans Réglages la remet à zéro.
   */
  const pages = [
    {
      titre: 'Bienvenue',
      texte: 'ecole2recte est un client ÉcoleDirecte lisible, sur ordinateur comme sur téléphone. L’accueil réunit le prochain cours, le travail à faire et les dernières notes ; l’emploi du temps se lit au jour ou à la semaine.',
    },
    {
      titre: 'Notes et travail à faire',
      texte: 'Chaque moyenne dit si elle est officielle ou calculée par l’appli. Les devoirs se filtrent (à faire, faits, contrôles) et la recherche trouve un mot dans les devoirs, messages et notes, sans accents.',
    },
    {
      titre: 'Tes données, ton écran',
      texte: 'Ton mot de passe reste chiffré sur le serveur et ne descend jamais dans le navigateur ; « Rester connecté » t’évite de tout retaper. Dans Réglages : thèmes, taille du texte, verrouillage par code, et « Oublier cet appareil ».',
    },
  ]

  let ouverte = $state(false)
  let index = $state(0)

  onMount(() => {
    try { ouverte = localStorage.getItem('e2r-presentation') !== '1' } catch { ouverte = false }
  })

  function fermer(): void {
    ouverte = false
    try { localStorage.setItem('e2r-presentation', '1') } catch { /* stockage refusé : elle reviendra */ }
  }
</script>

{#if ouverte}
  <div class="voile" role="dialog" aria-modal="true" aria-labelledby="titre-presentation">
    <div class="carte boite">
      <p class="minuscule">{index + 1} sur {pages.length}</p>
      <h2 id="titre-presentation">{pages[index]!.titre}</h2>
      <p>{pages[index]!.texte}</p>
      <div class="actions">
        <button class="bouton" type="button" onclick={fermer}>Passer</button>
        <span class="espace"></span>
        {#if index > 0}<button class="bouton" type="button" onclick={() => (index -= 1)}>Précédent</button>{/if}
        {#if index < pages.length - 1}
          <button class="bouton primaire" type="button" onclick={() => (index += 1)}>Suivant</button>
        {:else}
          <button class="bouton primaire" type="button" onclick={fermer}>C’est parti</button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .voile {
    position: fixed;
    inset: 0;
    z-index: 900;
    display: grid;
    place-items: center;
    padding: 16px;
    background: rgb(0 0 0 / 45%);
  }
  .boite { width: min(440px, 100%); display: grid; gap: 10px; }
  .boite h2 { margin: 0; }
  .actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
  .espace { flex: 1; }
</style>
