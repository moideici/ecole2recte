<script lang="ts">
  import EnTete from '$lib/components/EnTete.svelte'
  import { PALETTES, TAILLES } from '$lib/preferences.js'
  import { THEMES, theme } from '$lib/theme.svelte.js'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()

  // Le même état que le bouton du bandeau : deux contrôles pour un seul réglage finissent
  // toujours par se contredire, et c'est celui qu'on regarde qui a l'air cassé.
  $effect(() => theme.relire())

  const POLICES: Record<string, string> = {
    deny: 'Fermée — aucune écriture ne part',
    'dry-run': 'Répétition — les écritures sont construites et tracées, rien ne part',
    allow: 'Ouverte — les écritures autorisées partent',
  }
</script>

<svelte:head><title>Réglages — ecole2recte</title></svelte:head>

<EnTete surtitre="Application" titre="Réglages" />

<section class="carte" style="margin-bottom:18px">
  <h2>Thème</h2>
  <div class="choix" role="group" aria-label="Thème de couleurs">
    {#each PALETTES as [valeur, libelle] (valeur)}
      <button class="pastille" aria-pressed={theme.palette === valeur} onclick={() => theme.choisirPalette(valeur)}>{libelle}</button>
    {/each}
  </div>
  <h2 style="margin-top:16px">Taille du texte</h2>
  <div class="choix" role="group" aria-label="Taille du texte">
    {#each TAILLES as [valeur, libelle] (valeur)}
      <button class="pastille" aria-pressed={theme.taille === valeur} onclick={() => theme.choisirTaille(valeur)}>{libelle}</button>
    {/each}
  </div>
  <div class="panneau" style="margin-top:16px" aria-label="Aperçu des réglages">
    <div class="tete-panneau"><h2>Aperçu : ma journée</h2></div>
    <div class="corps-panneau pile">
      <p>Mathématiques à 9 h · Salle 204</p>
      <p class="discret">Les couleurs et la taille du texte s’appliquent immédiatement à toute l’interface.</p>
      <a href="/" class="bouton primaire">Voir l’accueil</a>
    </div>
  </div>
</section>

<section class="carte" style="margin-bottom:18px">
  <h2>Apparence</h2>
  <div class="defilement" style="margin-top:10px" role="group" aria-label="Apparence">
    {#each THEMES as [valeur, libelle] (valeur)}
      <button class="pastille" aria-pressed={theme.valeur === valeur} onclick={() => theme.appliquer(valeur)}>
        {libelle}
      </button>
    {/each}
  </div>
</section>

<section class="carte" style="margin-bottom:18px">
  <h2>Modules de l’établissement</h2>
  <p class="discret" style="margin:6px 0 12px">
    Ce qu’ÉcoleDirecte déclare ouvert pour ce compte. Une section fermée n’est pas une panne.
  </p>
  <ul class="liste">
    {#each data.modules as module (module.section)}
      <li>
        <span>{module.libelle}</span>
        <span class={module.ouvert === null ? 'discret' : module.ouvert ? 'ok' : 'ko'}>
          {module.ouvert === null ? 'non déclaré' : module.ouvert ? 'ouvert' : 'fermé'}
        </span>
      </li>
    {/each}
  </ul>
</section>

<section class="carte" style="margin-bottom:18px">
  <h2>Écriture</h2>
  <p class="discret" style="margin:6px 0 12px">{POLICES[data.ecriture.police]}</p>
  <ul class="liste">
    {#each data.ecriture.fonctions as fonction (fonction.code)}
      <li>
        <span>{fonction.libelle}</span>
        <span class={fonction.ouverte ? 'ok' : 'discret'}>{fonction.ouverte ? 'ouverte' : 'fermée'}</span>
      </li>
    {/each}
  </ul>
  <p class="discret" style="margin-top:12px">
    Une fonction d’écriture ne s’ouvre qu’après son aller-retour réel : l’action, puis sa
    relecture depuis le serveur pour vérifier que ce qui est arrivé est bien ce qui a été
    envoyé.
  </p>
</section>

<section class="carte">
  <h2>Session</h2>
  <ul class="liste">
    <li><span>Profils lisibles</span><span class="discret">{data.session.profils}</span></li>
    <li><span>Jeton</span><span class="discret">{data.session.jeton ? 'présent (côté serveur)' : 'absent'}</span></li>
    <li><span>Version d’API déclarée</span><span class="discret">{data.session.version}</span></li>
  </ul>
  <p class="discret" style="margin-top:12px">
    Le jeton ne descend jamais jusqu’au navigateur : il reste sur le serveur, et le cookie ne
    contient qu’un identifiant opaque.
  </p>
</section>

<style>
  .choix { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .liste { list-style: none; margin: 0; padding: 0; }
  .liste li {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 9px 0;
    border-bottom: 1px solid var(--bordure);
  }
  .liste li:last-child { border-bottom: 0; }
  .ok { color: var(--succes); font-weight: 600; font-size: 0.9rem; }
  .ko { color: var(--encre-douce); font-size: 0.9rem; }
</style>
