<script lang="ts">
  import { page } from '$app/state'

  /**
   * « Actualiser ».
   *
   * Les données dorment cinq minutes dans la session : sans ce bouton, une note saisie à
   * l'instant reste invisible pendant cinq minutes et on croit l'application en panne. Le
   * rechargement garde les autres paramètres de l'adresse — période consultée, jour affiché —
   * sans quoi « actualiser » ramènerait ailleurs.
   */
  const href = $derived.by(() => {
    const params = new URLSearchParams(page.url.search)
    params.set('rafraichir', '1')
    return `${page.url.pathname}?${params.toString()}`
  })
</script>

<a class="pastille" {href} data-sveltekit-reload title="Recharger depuis ÉcoleDirecte">Actualiser</a>
