<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { anciennete, COOKIE_CACHE, peutRafraichir, raisons, type Raison } from '$lib/horsLigne.js'

  let enLigne = $state(true)
  let date = $state<number | null>(null)
  let derniereLecture = $state<number | null>(null)
  let raison = $state<Raison | null>(null)
  let maintenant = $state(Date.now())
  let geste = $state('')
  let message = $state('')
  const cause = $derived(!enLigne ? 'network' : raison)

  function actualiser() {
    if (!enLigne) { message = 'Vérifiez votre connexion avant de réessayer.'; return }
    if (!peutRafraichir(derniereLecture, Date.now())) { message = 'La dernière lecture date de moins de 90 s.'; return }
    const url = new URL(page.url)
    url.searchParams.set('rafraichir', '1')
    location.assign(url)
  }

  onMount(() => {
    const etat = (window as Window & { __e2rLecture?: { date: number; lecture: number; raison: Raison | null } }).__e2rLecture
    if (etat) { date = etat.date; derniereLecture = etat.lecture || null; raison = etat.raison }
    const reseau = () => { enLigne = navigator.onLine }
    reseau()
    const recevoir = (event: MessageEvent) => {
      if (event.data?.type === 'e2r-scope') {
        const scope = document.cookie.split('; ').find((cookie) => cookie.startsWith(`${COOKIE_CACHE}=`))?.slice(COOKIE_CACHE.length + 1)
        event.ports[0]?.postMessage(scope ?? null)
      }
      if (event.data?.type === 'e2r-lecture') {
        if (Number.isFinite(event.data.date) && event.data.date > 0) date = event.data.date
        if (Number.isFinite(event.data.lecture) && event.data.lecture > 0) derniereLecture = event.data.lecture
        raison = event.data.raison
        message = ''
      }
    }
    const soumettre = (event: SubmitEvent) => {
      if (navigator.onLine || !(event.target instanceof HTMLFormElement)) return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (new URL(event.target.action).pathname === '/deconnexion') {
        document.cookie = `${COOKIE_CACHE}=; Path=/; Max-Age=0; SameSite=Strict`
        navigator.serviceWorker?.controller?.postMessage({ type: 'e2r-effacer' })
        location.assign('/connexion')
      } else message = 'Hors ligne : cette action n’a pas été envoyée. Aucune écriture n’est mise en attente.'
    }
    let depart: { x: number; y: number } | null = null
    let distance = 0
    const debut = (event: TouchEvent) => {
      const cible = event.target as HTMLElement
      if (!matchMedia('(pointer: coarse)').matches || window.scrollY > 0 || event.touches.length !== 1 || !cible.closest('main') || cible.closest('input, textarea, select, button, a, [contenteditable]')) return
      const touche = event.touches[0]!
      depart = { x: touche.clientX, y: touche.clientY }
      distance = 0
      message = ''
    }
    const mouvement = (event: TouchEvent) => {
      if (!depart || event.touches.length !== 1) return
      const touche = event.touches[0]!
      distance = touche.clientY - depart.y
      if (Math.abs(touche.clientX - depart.x) > 40 || distance < 0 || window.scrollY > 0) { depart = null; geste = ''; return }
      if (distance > 12) {
        // Empêcher le geste natif évite une seconde requête hors de notre règle des 90 s.
        if (event.cancelable) event.preventDefault()
        geste = distance >= 72 ? 'Relâchez pour actualiser' : 'Tirez pour actualiser'
      }
    }
    const fin = () => {
      if (depart && distance >= 72) actualiser()
      depart = null
      geste = ''
    }
    const annuler = () => { depart = null; geste = '' }
    window.addEventListener('online', reseau)
    window.addEventListener('offline', reseau)
    navigator.serviceWorker?.addEventListener('message', recevoir)
    document.addEventListener('submit', soumettre, true)
    document.addEventListener('touchstart', debut, { passive: true })
    document.addEventListener('touchmove', mouvement, { passive: false })
    document.addEventListener('touchend', fin)
    document.addEventListener('touchcancel', annuler)
    const timer = setInterval(() => { maintenant = Date.now() }, 30_000)
    return () => {
      clearInterval(timer)
      window.removeEventListener('online', reseau)
      window.removeEventListener('offline', reseau)
      navigator.serviceWorker?.removeEventListener('message', recevoir)
      document.removeEventListener('submit', soumettre, true)
      document.removeEventListener('touchstart', debut)
      document.removeEventListener('touchmove', mouvement)
      document.removeEventListener('touchend', fin)
      document.removeEventListener('touchcancel', annuler)
    }
  })
</script>

{#if cause || message || geste}
  <aside class="repli" role="status" aria-live="polite">
    {#if cause}
      <strong>{raisons[cause].titre}</strong>{#if date} · {anciennete(date, maintenant)}{/if}
      <span>{raisons[cause].action}</span>
      {#if enLigne && cause !== 'stale-version' && cause !== 'account-blocked'}<button class="pastille" onclick={actualiser}>Réessayer</button>{/if}
    {/if}
    {#if geste || message}<span>{geste || message}</span>{/if}
  </aside>
{/if}

<style>
  .repli { margin-bottom: 16px; padding: 12px 14px; border: 1px solid var(--bordure); border-radius: var(--rayon-petit); background: var(--accent-doux); color: var(--encre); font-size: .9rem; overflow-wrap: anywhere; }
  span { display: block; margin-top: 4px; }
  button { margin-top: 8px; min-height: 44px; cursor: pointer; }
</style>
