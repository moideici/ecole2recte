<script lang="ts">
  import '../app.css'
  import { enhance } from '$app/forms'
  import { navigating } from '$app/state'
  import { LIBELLE_THEME, theme } from '$lib/theme.svelte.js'
  import Icone, { type NomIcone } from '$lib/components/Icone.svelte'
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
   * basse sur téléphone où les cinq premières entrées tiennent et le reste passe dans un
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
    { href: '/prof/classes', libelle: 'Classes', icone: 'classes' },
    { href: '/prof/cahier-de-textes', libelle: 'Cahier de textes', court: 'Cahier', icone: 'devoirs', module: 'CAHIER_DE_TEXTES' },
    { href: '/prof/notes', libelle: 'Notes', icone: 'notes', module: 'CARNET_NOTES' },
    { href: '/prof/messages', libelle: 'Messages', icone: 'messages', module: 'MESSAGERIE' },
    { href: '/prof/emploi-du-temps', libelle: 'Emploi du temps', court: 'Cours', icone: 'calendrier', module: 'EDT' },
  ]

  const entrees = $derived(
    (data.profil?.prof ? entreesProf : entreesEleve).filter(
      (entree) => !entree.module || !data.profil?.modulesFermes.includes(entree.module),
    ),
  )
  const principales = $derived(entrees.slice(0, 5))
  const secondaires = $derived(entrees.slice(5))
  let menuOuvert = $state(false)

  function actuel(href: string): boolean {
    // Un accueil n'est actuel que chez lui : `/prof` ne s'allume pas sur `/prof/notes`.
    return href === '/' || href === '/prof' ? data.chemin === href : data.chemin.startsWith(href)
  }
</script>

<a class="saut-contenu" href="#contenu">Aller au contenu</a>

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
    <p class="marque">ecole2recte</p>
    <span class="espace"></span>
    {#if data.profil}
      <a class="identite" href={data.profil.prof ? '/prof' : '/profil'}>
        <span class="avatar" aria-hidden="true">{data.profil.initiales}</span>
        <span class="qui">
          <span class="nom">{data.profil.nom}</span>
          <span class="sous">
            {#if data.profil.prof}
              Enseignant{data.profil.etablissement ? ` · ${data.profil.etablissement}` : ''}
            {:else}
              {[data.profil.classe, data.profil.etablissement].filter(Boolean).join(' · ')}
            {/if}
          </span>
        </span>
      </a>
    {/if}
    <button
      class="sortir"
      onclick={() => theme.basculer()}
      title={LIBELLE_THEME[theme.valeur]}
      aria-label={LIBELLE_THEME[theme.valeur]}
    >
      <Icone nom={theme.valeur === 'sombre' ? 'lune' : theme.valeur === 'clair' ? 'soleil' : 'auto'} />
    </button>
    <form method="POST" action="/deconnexion" use:enhance>
      <button class="sortir" title="Se déconnecter">
        <Icone nom="sortie" />
        <span class="texte-sortir">Se déconnecter</span>
      </button>
    </form>
  </header>

  <div class="coque">
    <aside class="laterale">
      {#if data.enfants.length > 1 && !data.profil?.prof}
        <!-- Un compte parent lit plusieurs enfants : le profil consulté se choisit ici. -->
        <form method="POST" action="/?/changerEnfant" use:enhance class="enfants" aria-label="Enfant consulté">
          <p class="minuscule" style="margin-bottom:6px">Enfant consulté</p>
          <div class="pile" style="gap:4px">
            {#each data.enfants as enfant (enfant.id)}
              <button class="enfant" name="enfant" value={enfant.id} aria-current={data.profil?.id === enfant.id}>
                <span class="avatar petit" aria-hidden="true">{enfant.initiales}</span>
                <span>
                  {enfant.nom}
                  {#if enfant.classe}<span class="discret" style="display:block;font-size:0.78rem">{enfant.classe}</span>{/if}
                </span>
              </button>
            {/each}
          </div>
        </form>
      {/if}

      <nav aria-label="Sections">
        <ul>
          {#each entrees as entree (entree.href)}
            <li>
              <a href={entree.href} aria-current={actuel(entree.href) ? 'page' : undefined}>
                <Icone nom={entree.icone} />
                <span>{entree.libelle}</span>
              </a>
            </li>
          {/each}
        </ul>
      </nav>
    </aside>

    <main id="contenu">
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
    <button aria-expanded={menuOuvert} onclick={() => (menuOuvert = !menuOuvert)}>
      <Icone nom="plus" taille={22} />
      <span>Plus</span>
    </button>
  </nav>

  {#if menuOuvert}
    <div class="tiroir" role="dialog" aria-label="Autres sections">
      {#each secondaires as entree (entree.href)}
        <a class="carte" href={entree.href} onclick={() => (menuOuvert = false)}>
          <Icone nom={entree.icone} />
          <span>{entree.libelle}</span>
        </a>
      {/each}
      <form method="POST" action="/deconnexion" use:enhance>
        <button class="bouton" style="width:100%">Se déconnecter</button>
      </form>
    </div>
  {/if}
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

  .marque { font-weight: 700; letter-spacing: -0.01em; font-size: 1.1rem; }

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
  .identite:hover { background: rgb(255 255 255 / 12%); }

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

  .qui { display: none; line-height: 1.2; }
  .nom { display: block; font-weight: 600; font-size: 0.92rem; }
  .sous { display: block; font-size: 0.78rem; color: var(--bandeau-encre-douce); }

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
  .sortir:hover { background: rgb(255 255 255 / 12%); }
  .texte-sortir { display: none; }

  /* ——————————————————————————————————————————— corps */

  .coque { display: block; }

  main {
    padding: 18px var(--marge) 96px;
    max-width: 1180px;
    margin: 0 auto;
  }

  .laterale { display: none; }
  .enfants { margin-bottom: 8px; }

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
    color: var(--encre);
    text-decoration: none;
    min-height: 44px;
    font-size: 0.94rem;
    border-left: 3px solid transparent;
  }
  nav[aria-label='Sections'] a:hover { background: var(--surface-3); }
  nav[aria-label='Sections'] a[aria-current='page'] {
    background: var(--accent-doux);
    color: var(--accent-fort);
    font-weight: 650;
    border-left-color: var(--accent);
  }

  /* ——————————————————————————————————————————— barre basse */

  .basse {
    position: fixed;
    inset: auto 0 0 0;
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 2px;
    background: var(--surface);
    border-top: 1px solid var(--bordure);
    padding: 4px 4px calc(4px + env(safe-area-inset-bottom));
    z-index: 20;
  }
  .basse a, .basse button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-height: 48px;
    padding: 4px 2px;
    font-size: 0.64rem;
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
  .basse a[aria-current='page'] { color: var(--accent); font-weight: 650; }
  .basse span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }

  .tiroir {
    position: fixed;
    inset: auto 8px 84px 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 25;
  }
  .tiroir a { display: flex; align-items: center; gap: 10px; text-decoration: none; box-shadow: var(--ombre-haute); }

  /* À partir de 900 px l'écran a la place d'une barre latérale permanente. */
  @media (min-width: 900px) {
    .qui, .texte-sortir { display: block; }
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
      border-right: 1px solid var(--bordure);
      background: var(--surface);
    }
    main { padding: 24px 28px 56px; }
    .basse, .tiroir { display: none; }
  }
</style>
