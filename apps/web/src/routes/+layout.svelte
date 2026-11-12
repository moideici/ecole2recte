<script lang="ts">
  import '../app.css'
  import { enhance } from '$app/forms'
  import { navigating } from '$app/state'
  import { LIBELLE_THEME, theme } from '$lib/theme.svelte.js'
  import Icone, { type NomIcone } from '$lib/components/Icone.svelte'
  import Lapin from '$lib/components/Lapin.svelte'
  import Bandeau from '$lib/components/Bandeau.svelte'
  import Verrou from '$lib/components/Verrou.svelte'
  import Presentation from '$lib/components/Presentation.svelte'
  import type { LayoutData } from './$types'

  let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props()

  // Le thème est à portée de main dans le bandeau : c'est un geste qu'on fait le soir, pas
  // une préférence qu'on va chercher dans un écran de réglages.
  $effect(() => theme.relire())

  interface Entree {
    href: string
    libelle: string
    icone: NomIcone
    /** Le libellé de la barre basse, où « Emploi du temps » ne tient pas sur un téléphone. */
    court?: string
    /** Le module ÉcoleDirecte dont dépend la section : fermé, elle disparaît. */
    module?: string
  }

  /**
   * La navigation.
   *
   * Une seule liste sert les deux tailles d'écran : barre latérale sur ordinateur, barre
   * basse sur téléphone où quatre entrées tiennent et le reste passe dans un
   * menu. Dupliquer la liste garantirait qu'elles divergent un jour.
   *
   * L'ordre est celui des logiciels de vie scolaire, et il n'est pas arbitraire : l'emploi
   * du temps et le travail à faire d'abord, parce que ce sont les deux écrans qu'on ouvre
   * tous les jours.
   */
  const entreesEleve: Entree[] = [
    { href: '/', libelle: 'Accueil', icone: 'accueil' },
    { href: '/emploi-du-temps', libelle: 'Emploi du temps', court: 'Cours', icone: 'calendrier' },
    { href: '/devoirs', libelle: 'Travail à faire', court: 'Travail', icone: 'devoirs' },
    { href: '/notes', libelle: 'Notes', icone: 'notes' },
    { href: '/messages', libelle: 'Messages', icone: 'messages' },
    { href: '/vie-scolaire', libelle: 'Vie scolaire', court: 'Vie sco.', icone: 'vie-scolaire' },
    { href: '/documents', libelle: 'Documents', icone: 'documents' },
    { href: '/actualites', libelle: 'Actualités', icone: 'actualites' },
    { href: '/manuels', libelle: 'Manuels', icone: 'manuels' },
    { href: '/cloud', libelle: 'Stockage', icone: 'stockage' },
    { href: '/reglages', libelle: 'Réglages', icone: 'reglages' },
  ]

  /** L'espace professeur, en lecture seule. */
  const entreesProf: Entree[] = [
    { href: '/prof', libelle: 'Accueil', icone: 'accueil' },
    { href: '/prof/emploi-du-temps', libelle: 'Emploi du temps', court: 'Cours', icone: 'calendrier', module: 'EDT' },
    { href: '/prof/classes', libelle: 'Classes', icone: 'classes' },
    { href: '/prof/cahier-de-textes', libelle: 'Cahier de textes', court: 'Cahier', icone: 'devoirs', module: 'CAHIER_DE_TEXTES' },
    { href: '/prof/notes', libelle: 'Notes', icone: 'notes', module: 'CARNET_NOTES' },
    { href: '/prof/messages', libelle: 'Messages', icone: 'messages', module: 'MESSAGERIE' },
  ]

  const entrees = $derived(
    (data.profil?.prof ? entreesProf : entreesEleve).filter(
      (entree) => !entree.module || !data.profil?.modulesFermes.includes(entree.module),
    ),
  )
  const principales = $derived(entrees.slice(0, 4))
  const secondaires = $derived(entrees.slice(4))
  let plus: HTMLDetailsElement | undefined = $state()
  let compte: HTMLDetailsElement | undefined = $state()
  // Les menus se referment quand la page ou le profil change, mais PAS au premier passage :
  // un menu ouvert avant la fin de l'hydratation (téléphone lent) se refermait aussitôt.
  let cle: string | undefined
  $effect(() => {
    const suivante = `${data.chemin}|${data.profil?.id}`
    if (cle !== undefined && cle !== suivante) {
      plus?.removeAttribute('open')
      compte?.removeAttribute('open')
    }
    cle = suivante
  })
  const groupes = ["Aujourd\u2019hui", 'Travail', 'Vie scolaire', 'Communication', 'Documents']
  function groupe(href: string): string {
    if (/emploi-du-temps$/.test(href) || href === '/' || href === '/prof') return groupes[0]!
    if (/devoirs|cahier-de-textes|notes/.test(href)) return 'Travail'
    if (/messages|actualites/.test(href)) return 'Communication'
    if (/documents|manuels|cloud/.test(href)) return 'Documents'
    return 'Vie scolaire'
  }

  function actuel(href: string): boolean {
    // Un accueil n'est actuel que chez lui : `/prof` ne s'allume pas sur `/prof/notes`.
    return href === '/' || href === '/prof' ? data.chemin === href : data.chemin.startsWith(href)
  }
</script>

<a class="saut-contenu" href="#contenu">Aller au contenu</a>
{#if data.connecte}
  <Verrou />
  <Presentation />
{/if}
<svelte:window onkeydown={(event) => {
  if (event.key === 'Escape') {
    if (plus?.open) { plus.open = false; plus.querySelector('summary')?.focus() }
    if (compte?.open) { compte.open = false; compte.querySelector('summary')?.focus() }
  }
}} />

{#if !data.connecte}
  <main id="contenu" class="seul">{@render children()}</main>
{:else}
  <!--
    Le bandeau de marque, présent sur toutes les tailles d'écran : c'est lui qui dit de quel
    compte on regarde la scolarité. Sur un compte parent qui suit deux enfants, le confondre
    coûte cher.
  -->
  <!--
    La barre de progression. Chaque clic est un aller-retour serveur : sans elle, un lien
    lent est indiscernable d'un lien mort, et on reclique.
  -->
  {#if navigating.to}
    <div class="progression" role="status" aria-label="Chargement en cours"></div>
  {/if}

  <header class="bandeau">
    <a class="marque" href={data.profil?.prof ? '/prof' : '/'} aria-label="ecole2recte, accueil">
      <Lapin taille={34} />
      <span>ecole2recte</span>
    </a>
    <span class="espace"></span>
    <details class="compte" bind:this={compte}>
      <summary class="identite">
        <span class="avatar" aria-hidden="true">{data.profil?.initiales}</span>
        <span class="nom">{data.profil?.nom}</span><span aria-hidden="true">⌄</span>
      </summary>
      <div class="menu-compte">
        <p class="discret">{data.profil?.prof ? 'Enseignant' : data.profil?.parent ? 'Compte parent' : 'Compte \u00e9l\u00e8ve'}{data.profil?.classe ? ` \u00b7 ${data.profil.classe}` : ''}</p>
        {#if data.enfants.length > 1 && !data.profil?.prof}
          <form method="POST" action="/?/changerEnfant" use:enhance class="pile" aria-label="Profil consulté">
            {#each data.enfants as enfant (enfant.id)}
              <button class="enfant" name="enfant" value={enfant.id} aria-current={data.profil?.id === enfant.id}>
                <span class="avatar petit" aria-hidden="true">{enfant.initiales}</span>
                <span>{enfant.nom}{enfant.classe ? ` \u00b7 ${enfant.classe}` : ''}</span>
              </button>
            {/each}
          </form>
        {/if}
        {#if !data.profil?.prof}<a href="/profil">Mon profil</a>{/if}
        <form method="POST" action="/deconnexion" use:enhance>
          <button class="bouton">Se déconnecter</button>
        </form>
      </div>
    </details>
    <button
      class="sortir"
      onclick={() => theme.basculer()}
      title={LIBELLE_THEME[theme.valeur]}
      aria-label={LIBELLE_THEME[theme.valeur]}
    >
      <Icone nom={theme.valeur === 'sombre' ? 'lune' : theme.valeur === 'clair' ? 'soleil' : 'auto'} />
    </button>
  </header>

  <div class="coque">
    <aside class="laterale">
      <nav aria-label="Sections">
        {#each groupes as nom}
          {@const liens = entrees.filter((entree) => groupe(entree.href) === nom)}
          {#if liens.length}
            <p class="groupe">{nom}</p>
            <ul>
              {#each liens as entree (entree.href)}
                <li><a href={entree.href} aria-current={actuel(entree.href) ? 'page' : undefined}>
                  <Icone nom={entree.icone} /><span>{entree.libelle}</span>
                </a></li>
              {/each}
            </ul>
          {/if}
        {/each}
      </nav>
    </aside>

    <main id="contenu">
      <Bandeau />
      {#if data.demo}
        <p class="demo" role="note">
          <strong>Démo</strong> · données fictives, aucune requête ne part vers ÉcoleDirecte.
        </p>
      {/if}
      {@render children()}
    </main>
  </div>

  <nav class="basse" aria-label="Sections principales">
    {#each principales as entree (entree.href)}
      <a href={entree.href} aria-label={entree.libelle} aria-current={actuel(entree.href) ? 'page' : undefined}>
        <Icone nom={entree.icone} taille={22} />
        <span>{entree.court ?? entree.libelle}</span>
      </a>
    {/each}
    <details class="plus" bind:this={plus}>
      <summary class:actif={secondaires.some((entree) => actuel(entree.href))}><Icone nom="plus" taille={22} /><span>Plus</span></summary>
      <div class="tiroir">
        <h2>Autres sections</h2>
        {#each groupes as nom}
          {@const liens = secondaires.filter((entree) => groupe(entree.href) === nom)}
          {#if liens.length}
            <p class="minuscule">{nom}</p>
            {#each liens as entree (entree.href)}
              <a href={entree.href} aria-current={actuel(entree.href) ? 'page' : undefined}>
                <Icone nom={entree.icone} /><span>{entree.libelle}</span>
              </a>
            {/each}
          {/if}
        {/each}
      </div>
    </details>
  </nav>
{/if}

<style>
  .seul { max-width: 460px; margin: 0 auto; padding: 48px 20px; }

  .progression {
    position: fixed;
    inset: 0 auto auto 0;
    height: 3px;
    width: 100%;
    z-index: 40;
    background: linear-gradient(90deg, transparent, var(--accent) 45%, var(--accent) 55%, transparent);
    background-size: 220% 100%;
    animation: glisse 1.1s linear infinite;
  }
  @keyframes glisse {
    from { background-position: 120% 0; }
    to { background-position: -20% 0; }
  }

  /* ——————————————————————————————————————————— bandeau */

  .bandeau {
    position: sticky;
    top: 0;
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 var(--marge);
    min-height: 56px;
    background: var(--bandeau);
    color: var(--bandeau-encre);
    box-shadow: var(--ombre);
  }

  .marque {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    letter-spacing: -0.01em;
    font-size: 1.1rem;
    color: inherit;
    text-decoration: none;
  }

  .identite {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 5px 10px;
    border-radius: 999px;
    color: inherit;
    text-decoration: none;
    min-height: 44px;
  }
  .identite:hover { background: var(--rail-actif); }

  .avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    flex: none;
    border-radius: 999px;
    background: var(--bandeau-encre);
    color: var(--bandeau);
    font-weight: 700;
    font-size: 0.8rem;
  }
  .avatar.petit { width: 28px; height: 28px; font-size: 0.72rem; background: var(--accent); color: var(--accent-encre); }

  .nom { display: block; font-weight: 600; font-size: 0.92rem; }

  .sortir {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 44px;
    min-width: 44px;
    padding: 0 10px;
    border: 0;
    border-radius: var(--rayon-petit);
    background: none;
    color: inherit;
    font: inherit;
    font-size: 0.9rem;
    cursor: pointer;
  }
  .sortir:hover { background: var(--rail-actif); }

  /* ——————————————————————————————————————————— corps */

  .coque { display: block; }

  main {
    min-width: 0; width: 100%;
    padding: 18px var(--marge) 96px;
    max-width: 1180px;
    margin: 0 auto;
  }

  .laterale { display: none; }

  .enfant {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    text-align: left;
    min-height: 44px;
    padding: 6px 10px;
    border-radius: var(--rayon-petit);
    border: 1px solid var(--bordure);
    background: var(--surface);
    color: var(--encre);
    font: inherit;
    font-size: 0.9rem;
    cursor: pointer;
  }
  .enfant[aria-current='true'] { border-color: var(--accent); background: var(--accent-doux); color: var(--accent-fort); font-weight: 600; }

  .demo {
    margin-bottom: 16px;
    padding: 10px 14px;
    border: 1px solid var(--accent);
    border-radius: var(--rayon-petit);
    background: var(--accent-doux);
    color: var(--accent-fort);
    font-size: 0.9rem;
  }

  nav[aria-label='Sections'] ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
  nav[aria-label='Sections'] a {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    border-radius: var(--rayon-petit);
    color: var(--rail-encre-douce);
    text-decoration: none;
    min-height: 44px;
    font-size: 0.94rem;
    border-left: 3px solid transparent;
  }
  nav[aria-label='Sections'] a:hover { background: var(--rail-actif); color: var(--rail-encre); }
  nav[aria-label='Sections'] a[aria-current='page'] {
    background: var(--rail-actif);
    color: var(--rail-encre);
    font-weight: 650;
    border-left-color: var(--rail-encre);
  }

  /* ——————————————————————————————————————————— barre basse */

  .basse {
    position: fixed;
    inset: auto 0 0 0;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 2px;
    background: var(--surface);
    border-top: 1px solid var(--bordure);
    padding: 4px 4px calc(4px + env(safe-area-inset-bottom));
    z-index: 20;
  }
  .basse > a, .plus > summary {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-height: 48px;
    padding: 4px 2px;
    font-size: 0.74rem;
    text-align: center;
    color: var(--encre-douce);
    text-decoration: none;
    background: none;
    border: 0;
    border-radius: var(--rayon-petit);
    font-family: inherit;
    cursor: pointer;
    line-height: 1.15;
  }
  .basse a[aria-current='page'], .plus > summary.actif { background: var(--accent-doux); color: var(--accent-fort); font-weight: 650; }
  .basse span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }

  .tiroir {
    position: fixed;
    inset: auto 8px calc(68px + env(safe-area-inset-bottom)) 8px;
    max-height: 70dvh; overflow-y: auto; padding: 16px; background: var(--surface); color: var(--encre); border: 1px solid var(--bordure); border-radius: var(--rayon-grand); box-shadow: var(--ombre-haute);
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 25;
  }
  .tiroir a { display: flex; align-items: center; gap: 10px; text-decoration: none; min-height: 44px; padding: 8px; }

  .groupe { margin: 16px 12px 4px; font-size: 0.74rem; font-weight: 700; color: var(--rail-encre-douce); }
  summary { cursor: pointer; list-style: none; }
  summary::-webkit-details-marker { display: none; }
  .compte { position: relative; min-width: 0; }
  .identite .nom { max-width: 30vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .menu-compte { position: absolute; right: 0; top: 100%; width: min(320px, calc(100vw - 32px)); display: grid; gap: 12px; padding: 16px; background: var(--surface); color: var(--encre); box-shadow: var(--ombre-haute); border: 1px solid var(--bordure); border-radius: var(--rayon); }
  .menu-compte > a { min-height: 44px; display: flex; align-items: center; }
  @media (max-width: 480px) {
    .marque > span { display: none; }
    .bandeau { gap: 4px; }
    .identite { gap: 6px; padding: 5px; }
  }

  /* À partir de 900 px l'écran a la place d'une barre latérale permanente. */
  @media (min-width: 900px) {
    .coque { display: grid; grid-template-columns: 252px 1fr; align-items: start; max-width: 1440px; margin: 0 auto; }
    .laterale {
      display: flex;
      flex-direction: column;
      gap: 12px;
      position: sticky;
      top: 56px;
      height: calc(100vh - 56px);
      padding: 16px 10px;
      overflow-y: auto;
      border-right: 0;
      background: var(--rail);
      color: var(--rail-encre);
    }
    main { padding: 24px 28px 56px; }
    .basse, .tiroir { display: none; }
  }
</style>
