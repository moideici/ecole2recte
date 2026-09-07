<script lang="ts">
  /**
   * L'en-tête d'une page.
   *
   * Le titre est annoncé comme un titre : un lecteur d'écran saute de titre en titre, et
   * sans cette marque il faut parcourir tout l'écran pour savoir où l'on est.
   */
  let {
    surtitre = '',
    titre,
    soustitre = '',
    actions,
  }: { surtitre?: string; titre: string; soustitre?: string; actions?: import('svelte').Snippet } = $props()
</script>

<header class="entete">
  <div>
    {#if surtitre}<p class="minuscule">{surtitre}</p>{/if}
    <h1>{titre}</h1>
    {#if soustitre}<p class="discret">{soustitre}</p>{/if}
  </div>
  {#if actions}
    <div class="rangee">{@render actions()}</div>
  {/if}
</header>

<style>
  .entete {
    display: flex;
    align-items: flex-end;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 18px;
  }
  .entete > div:first-child { flex: 1; min-width: 200px; }
</style>
