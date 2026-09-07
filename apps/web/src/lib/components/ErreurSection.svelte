<script lang="ts">
  /**
   * Une erreur affichée **là où elle s'est produite**, jamais en bandeau global : savoir que
   * ce sont les notes qui manquent, et non « quelque chose », change ce qu'on peut en faire.
   */
  let { message, cause = '' }: { message: string; cause?: string } = $props()
</script>

<p class="erreur" role="status">
  {message}
  {#if cause}<span class="discret" style="display:block;margin-top:4px">{cause}</span>{/if}
</p>
