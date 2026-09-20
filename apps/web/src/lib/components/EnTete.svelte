<script lang="ts">
  /**
   * L'en-tête d'une page.
   *
   * Le titre est annoncé comme un titre : un lecteur d'écran saute de titre en titre, et
   * sans cette marque il faut parcourir tout l'écran pour savoir où l'on est.
   *
   * Les commandes de la page — période, semaine, filtre — se rangent à droite du titre,
   * toujours au même endroit : c'est là qu'on les cherche d'un écran à l'autre.
   */
  let {
    surtitre = '',
    titre,
    soustitre = '',
    actions,
  }: { surtitre?: string; titre: string; soustitre?: string; actions?: import('svelte').Snippet } = $props()
</script>

<header class="entete">
  <div class="texte">
    {#if surtitre}<p class="minuscule">{surtitre}</p>{/if}
    <h1>{titre}</h1>
    {#if soustitre}<p class="discret">{soustitre}</p>{/if}
  </div>
  {#if actions}
    <div class="actions">{@render actions()}</div>
  {/if}
</header>

<style>
  .entete {
    display: flex;
    align-items: flex-end;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 2px solid var(--bordure);
  }
  .texte { flex: 1; min-width: 200px; }
  .actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
</style>
