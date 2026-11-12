<script lang="ts">
  import { onMount } from 'svelte'
  import {
    CLE_ACTIVITE, CLE_VERROU, attenteApresEchecs, deBase64, doitVerrouiller, lireVerrou, verifierCode,
    type EtatVerrou,
  } from '$lib/verrou.js'

  /*
   * L'écran de verrouillage. Une protection d'écran, pas un chiffrement : voir `verrou.ts`.
   *
   * Tant que la page est verrouillée, `data-verrou` sur la racine cache tout le reste (la
   * règle est dans `app.css`) — un simple calque laisserait le contenu lisible dans le DOM
   * et pour les lecteurs d'écran.
   */
  let etat = $state<EtatVerrou | null>(null)
  let verrouille = $state(false)
  let code = $state('')
  let message = $state('')
  let echecs = 0
  let bloqueJusqua = 0
  let cacheLe = 0
  let champ: HTMLInputElement | undefined = $state()

  const racine = () => document.documentElement

  function activite(): void {
    try { localStorage.setItem(CLE_ACTIVITE, String(Date.now())) } catch { /* stockage refusé */ }
  }

  function verrouiller(): void {
    if (!etat) return
    verrouille = true
    racine().setAttribute('data-verrou', '1')
    code = ''
    message = ''
    queueMicrotask(() => champ?.focus())
  }

  function deverrouiller(): void {
    verrouille = false
    echecs = 0
    racine().removeAttribute('data-verrou')
    activite()
  }

  async function essayer(): Promise<void> {
    if (!etat) return
    const reste = bloqueJusqua - Date.now()
    if (reste > 0) {
      message = `Trop d’essais. Réessaie dans ${Math.ceil(reste / 1000)} s.`
      return
    }
    if (await verifierCode(etat, code)) return deverrouiller()
    echecs += 1
    bloqueJusqua = Date.now() + attenteApresEchecs(echecs)
    code = ''
    message = 'Code incorrect.'
  }

  async function empreinte(): Promise<void> {
    if (!etat?.webauthn) return
    try {
      const obtenu = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [{ type: 'public-key', id: deBase64(etat.webauthn) as BufferSource }],
          userVerification: 'required',
          timeout: 60_000,
        },
      })
      if (obtenu) deverrouiller()
    } catch {
      message = 'Vérification annulée ou refusée. Le code fonctionne toujours.'
    }
  }

  /** Code oublié : la seule issue est de se déconnecter, ce qui efface aussi le verrou. */
  function oublie(): void {
    try { localStorage.removeItem(CLE_VERROU); localStorage.removeItem(CLE_ACTIVITE) } catch { /* rien */ }
    racine().removeAttribute('data-verrou')
  }

  onMount(() => {
    etat = lireVerrou((() => { try { return localStorage.getItem(CLE_VERROU) } catch { return null } })())
    if (!etat) { racine().removeAttribute('data-verrou'); return }

    // Au chargement : verrouillé si l'inactivité dépasse le délai (ou si le délai est 0).
    const derniere = Number((() => { try { return localStorage.getItem(CLE_ACTIVITE) } catch { return '0' } })()) || 0
    if (doitVerrouiller(etat.delai, Date.now() - derniere)) verrouiller()
    else { verrouille = false; racine().removeAttribute('data-verrou') }

    const surVisibilite = () => {
      if (!etat) return
      if (document.hidden) { cacheLe = Date.now(); return }
      if (cacheLe && !verrouille && doitVerrouiller(etat.delai, Date.now() - cacheLe)) verrouiller()
      cacheLe = 0
    }
    const surActivite = () => { if (!verrouille) activite() }
    // Inactivité sans quitter la page : on vérifie toutes les 15 s, c'est assez fin pour un délai en minutes.
    const minuterie = setInterval(() => {
      if (!etat || verrouille || etat.delai === 0) return
      const last = Number(localStorage.getItem(CLE_ACTIVITE)) || Date.now()
      if (doitVerrouiller(etat.delai, Date.now() - last)) verrouiller()
    }, 15_000)

    document.addEventListener('visibilitychange', surVisibilite)
    for (const nom of ['pointerdown', 'keydown', 'scroll']) window.addEventListener(nom, surActivite, { passive: true })
    // Le réglage change depuis Réglages (même onglet) : on relit l'état.
    const surChangement = () => {
      etat = lireVerrou(localStorage.getItem(CLE_VERROU))
      if (!etat) deverrouiller()
    }
    window.addEventListener('e2r-verrou', surChangement)
    window.addEventListener('storage', surChangement)
    return () => {
      clearInterval(minuterie)
      document.removeEventListener('visibilitychange', surVisibilite)
      for (const nom of ['pointerdown', 'keydown', 'scroll']) window.removeEventListener(nom, surActivite)
      window.removeEventListener('e2r-verrou', surChangement)
      window.removeEventListener('storage', surChangement)
    }
  })
</script>

{#if verrouille && etat}
  <div class="verrou" role="dialog" aria-modal="true" aria-labelledby="titre-verrou">
    <div class="boite">
      <h1 id="titre-verrou">ecole2recte est verrouillée</h1>
      <p class="discret">Saisis ton code pour continuer.</p>
      <form class="boite" onsubmit={(e) => { e.preventDefault(); void essayer() }}>
      <input
        class="champ"
        bind:this={champ}
        bind:value={code}
        type="password"
        inputmode="numeric"
        autocomplete="off"
        maxlength="6"
        aria-label="Code de verrouillage"
        aria-describedby="message-verrou"
      />
      <p id="message-verrou" class="message" role="alert">{message}</p>
      <button class="bouton primaire" type="submit">Déverrouiller</button>
      </form>
      {#if etat.webauthn}
        <button class="bouton" type="button" onclick={empreinte}>Empreinte ou code de l’appareil</button>
      {/if}
      <form method="POST" action="/deconnexion" onsubmit={oublie}>
        <button class="lien" type="submit">Code oublié ? Se déconnecter</button>
      </form>
    </div>
  </div>
{/if}

<style>
  .verrou {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: grid;
    place-items: center;
    padding: 16px;
    background: var(--fond);
  }
  .boite { display: grid; gap: 12px; width: min(340px, 100%); text-align: center; }
  .boite h1 { font-size: 1.2rem; margin: 0; }
  .boite :global(.champ) { text-align: center; font-size: 1.4rem; letter-spacing: 0.3em; }
  .message { min-height: 1.4em; margin: 0; color: var(--erreur); font-size: 0.9rem; }
  .lien { background: none; border: 0; color: var(--lien); text-decoration: underline; cursor: pointer; font: inherit; }
</style>
