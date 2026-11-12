<script lang="ts">
  import { onMount } from 'svelte'
  import {
    CLE_ACTIVITE, CLE_VERROU, DELAIS, codeValide, creerVerrou, enBase64, libelleDelai, lireVerrou, verifierCode,
    type Delai, type EtatVerrou,
  } from '$lib/verrou.js'

  let etat = $state<EtatVerrou | null>(null)
  let code = $state('')
  let confirmation = $state('')
  let delai = $state<Delai>(5)
  let ancien = $state('')
  let message = $state('')
  let webauthnPossible = $state(false)

  onMount(() => {
    try { etat = lireVerrou(localStorage.getItem(CLE_VERROU)) } catch { etat = null }
    if (etat) delai = etat.delai
    webauthnPossible = typeof PublicKeyCredential !== 'undefined' && !!navigator.credentials
  })

  function garder(valeur: EtatVerrou | null): void {
    try {
      if (valeur) localStorage.setItem(CLE_VERROU, JSON.stringify(valeur))
      else { localStorage.removeItem(CLE_VERROU); localStorage.removeItem(CLE_ACTIVITE) }
    } catch { message = 'Le navigateur refuse de garder ce réglage.'; return }
    etat = valeur
    window.dispatchEvent(new Event('e2r-verrou'))
  }

  async function activer(): Promise<void> {
    message = ''
    if (!codeValide(code)) return void (message = 'Le code doit comporter 4 à 6 chiffres.')
    if (code !== confirmation) return void (message = 'Les deux codes ne sont pas identiques.')
    garder(await creerVerrou(code, delai, etat?.webauthn))
    // Le verrou vient d'être posé par quelqu'un qui est là : pas de verrouillage immédiat.
    try { localStorage.setItem(CLE_ACTIVITE, String(Date.now())) } catch { /* rien */ }
    code = confirmation = ''
    message = 'Verrouillage activé.'
  }

  async function changerDelai(): Promise<void> {
    if (etat) garder({ ...etat, delai })
  }

  async function desactiver(): Promise<void> {
    message = ''
    if (!etat || !(await verifierCode(etat, ancien))) return void (message = 'Code actuel incorrect.')
    garder(null)
    ancien = ''
    message = 'Verrouillage désactivé.'
  }

  /** Associe l'empreinte ou le code de l'appareil : une simple porte locale, rien n'est envoyé. */
  async function ajouterEmpreinte(): Promise<void> {
    message = ''
    if (!etat) return
    try {
      const cree = (await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: 'ecole2recte' },
          user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'appareil', displayName: 'Cet appareil' },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
          authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
          timeout: 60_000,
        },
      })) as PublicKeyCredential | null
      if (!cree) return
      garder({ ...etat, webauthn: enBase64(cree.rawId) })
      message = 'Empreinte ou code de l’appareil associé.'
    } catch {
      message = 'Association annulée ou impossible sur cet appareil.'
    }
  }

  function retirerEmpreinte(): void {
    if (!etat) return
    const { webauthn: _retire, ...reste } = etat
    garder(reste)
  }

  function revoirPresentation(): void {
    try { localStorage.removeItem('e2r-presentation') } catch { /* rien */ }
    location.assign('/')
  }
</script>

<section class="carte" style="margin-bottom:18px">
  <h2>Verrouillage de l’application</h2>
  <p class="discret">
    Un écran de code qui s’affiche après un temps d’inactivité, pour qu’on ne lise pas tes notes
    sur un écran laissé ouvert. <strong>C’est une protection d’écran, pas un chiffrement :</strong>
    elle ne protège pas contre quelqu’un qui maîtrise le navigateur. Le code reste sur cet
    appareil et n’est jamais envoyé au serveur.
  </p>

  {#if etat}
    <p style="margin-top:10px"><strong>Activé.</strong> {libelleDelai(etat.delai)}.</p>
    <label class="pile" style="gap:6px;margin-top:8px">
      <span class="minuscule">Verrouiller</span>
      <select class="champ" bind:value={delai} onchange={changerDelai}>
        {#each DELAIS as d}<option value={d}>{libelleDelai(d)}</option>{/each}
      </select>
    </label>

    {#if webauthnPossible}
      <div style="margin-top:12px">
        {#if etat.webauthn}
          <p>Empreinte ou code de l’appareil : <strong>associé</strong>.</p>
          <button class="bouton" type="button" onclick={retirerEmpreinte}>Retirer</button>
        {:else}
          <button class="bouton" type="button" onclick={ajouterEmpreinte}>Ajouter l’empreinte ou le code de l’appareil</button>
        {/if}
      </div>
    {/if}

    <form class="pile" style="margin-top:14px;gap:8px" onsubmit={(e) => { e.preventDefault(); void desactiver() }}>
      <label class="pile" style="gap:6px">
        <span class="minuscule">Code actuel, pour désactiver</span>
        <input class="champ" type="password" inputmode="numeric" maxlength="6" autocomplete="off" bind:value={ancien} />
      </label>
      <button class="bouton">Désactiver le verrouillage</button>
    </form>
  {:else}
    <form class="pile" style="margin-top:12px;gap:10px" onsubmit={(e) => { e.preventDefault(); void activer() }}>
      <label class="pile" style="gap:6px">
        <span class="minuscule">Code (4 à 6 chiffres)</span>
        <input class="champ" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" bind:value={code} />
      </label>
      <label class="pile" style="gap:6px">
        <span class="minuscule">Répéter le code</span>
        <input class="champ" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" bind:value={confirmation} />
      </label>
      <label class="pile" style="gap:6px">
        <span class="minuscule">Verrouiller</span>
        <select class="champ" bind:value={delai}>
          {#each DELAIS as d}<option value={d}>{libelleDelai(d)}</option>{/each}
        </select>
      </label>
      <button class="bouton primaire">Activer le verrouillage</button>
    </form>
  {/if}
  <p role="status" class="discret" style="margin-top:8px;min-height:1.4em">{message}</p>
</section>

<section class="carte" style="margin-bottom:18px">
  <h2>Présentation</h2>
  <p class="discret">Les trois pages d’accueil, si tu veux les revoir.</p>
  <button class="bouton" type="button" onclick={revoirPresentation} style="margin-top:8px">Revoir la présentation</button>
</section>
