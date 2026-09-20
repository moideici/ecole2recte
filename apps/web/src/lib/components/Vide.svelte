<script lang="ts">
  /**
   * L'état vide.
   *
   * Sans cadre : il vit presque toujours **dans** un panneau, qui porte déjà le sien. Une
   * boîte dans une boîte ferait croire à un contenu là où il n'y en a pas.
   */
  let { titre, description = '' }: { titre: string; description?: string } = $props()
</script>

<div class="vide">
  <p class="titre">{titre}</p>
  {#if description}<p class="discret">{description}</p>{/if}
</div>

<style>
  .vide {
    text-align: center;
    padding: 28px 20px;
    border-radius: var(--rayon);
    background: var(--surface-2);
    border: 1px dashed var(--bordure);
  }
  .titre { font-weight: 600; }
</style>
