<script lang="ts">
  import '../app.css'
  import { enhance } from '$app/forms'
  import type { LayoutData } from './$types'

  let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props()

  interface Entree {
    href: string
    libelle: string
    /** Le module ÉcoleDirecte dont dépend la section : fermé, elle disparaît. */
    module?: string
  }

  /**
   * La navigation.
   *
   * Une seule liste sert les deux tailles d'écran : barre latérale sur ordinateur, barre
   * basse sur téléphone où les cinq premières entrées tiennent et le reste passe dans un
   * menu. Dupliquer la liste garantirait qu'elles divergent un jour.
   */
  const entreesEleve: Entree[] = [
    { href: '/', libelle: 'Accueil' },
    { href: '/emploi-du-temps', libelle: 'Emploi du temps' },
    { href: '/devoirs', libelle: 'Devoirs' },
    { href: '/notes', libelle: 'Notes' },
    { href: '/messages', libelle: 'Messages' },
    { href: '/vie-scolaire', libelle: 'Vie scolaire' },
    { href: '/documents', libelle: 'Documents' },
    { href: '/actualites', libelle: 'Actualités' },
    { href: '/manuels', libelle: 'Manuels' },
    { href: '/cloud', libelle: 'Stockage' },
    { href: '/reglages', libelle: 'Réglages' },
  ]

  /** L'espace professeur, en lecture seule. */
  const entreesProf: Entree[] = [
    { href: '/prof', libelle: 'Accueil' },
    { href: '/prof/classes', libelle: 'Classes' },
    { href: '/prof/cahier-de-textes', libelle: 'Cahier de textes', module: 'CAHIER_DE_TEXTES' },
    { href: '/prof/notes', libelle: 'Notes', module: 'CARNET_NOTES' },
    { href: '/prof/messages', libelle: 'Messages', module: 'MESSAGERIE' },
    { href: '/prof/emploi-du-temps', libelle: 'Emploi du temps', module: 'EDT' },
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
  <div class="coque">
    <aside class="laterale">
      <p class="marque">ecole2recte</p>

      {#if data.profil}
        <div class="profil carte">
          <p style="font-weight:600">{data.profil.nom}</p>
          <p class="discret">
            {#if data.profil.prof}
              Enseignant{data.profil.etablissement ? ` · ${data.profil.etablissement}` : ''}
            {:else}
              {data.profil.classe}{data.profil.classe && data.profil.etablissement ? ' · ' : ''}{data.profil.etablissement}
            {/if}
          </p>
        </div>
      {/if}

      {#if data.enfants.length > 1 && !data.profil?.prof}
        <!-- Un compte parent lit plusieurs enfants : le profil consulté se choisit ici. -->
        <form method="POST" action="/?/changerEnfant" use:enhance class="enfants" aria-label="Enfant consulté">
          <div class="defilement">
            {#each data.enfants as enfant (enfant.id)}
              <button
                class="pastille"
                name="enfant"
                value={enfant.id}
                aria-current={data.profil?.id === enfant.id}
              >{enfant.nom}</button>
            {/each}
          </div>
        </form>
      {/if}

      <nav aria-label="Sections">
        <ul>
          {#each entrees as entree (entree.href)}
            <li>
              <a href={entree.href} aria-current={actuel(entree.href) ? 'page' : undefined}>{entree.libelle}</a>
            </li>
          {/each}
        </ul>
      </nav>

      <form method="POST" action="/deconnexion" use:enhance>
        <button class="bouton" style="width:100%">Se déconnecter</button>
      </form>
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
      <a href={entree.href} aria-current={actuel(entree.href) ? 'page' : undefined}>{entree.libelle}</a>
    {/each}
    <button aria-expanded={menuOuvert} onclick={() => (menuOuvert = !menuOuvert)}>Plus</button>
  </nav>

  {#if menuOuvert}
    <div class="tiroir" role="dialog" aria-label="Autres sections">
      {#each secondaires as entree (entree.href)}
        <a class="carte" href={entree.href} onclick={() => (menuOuvert = false)}>{entree.libelle}</a>
      {/each}
      <form method="POST" action="/deconnexion" use:enhance>
        <button class="bouton" style="width:100%">Se déconnecter</button>
      </form>
    </div>
  {/if}
{/if}

<style>
  .seul { max-width: 460px; margin: 0 auto; padding: 48px 20px; }

  .coque { display: block; }

  main {
    padding: 20px var(--marge) 92px;
    max-width: 1100px;
    margin: 0 auto;
  }

  .laterale { display: none; }

  .marque {
    font-weight: 700;
    letter-spacing: -0.01em;
    font-size: 1.15rem;
    margin-bottom: 4px;
    color: var(--accent);
  }
  .profil {
    padding: 12px 14px;
    background: var(--accent-doux);
    border-color: var(--accent-doux);
  }
  .enfants { margin: 4px 0; }

  .demo {
    margin-bottom: 16px;
    padding: 10px 14px;
    border: 1px solid var(--accent);
    border-radius: var(--rayon-petit);
    background: var(--accent-doux);
    color: var(--accent);
    font-size: 0.9rem;
  }

  nav[aria-label='Sections'] ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
  nav[aria-label='Sections'] a {
    display: block;
    padding: 10px 12px;
    border-radius: var(--rayon-petit);
    color: var(--encre);
    text-decoration: none;
    min-height: 44px;
    line-height: 24px;
  }
  nav[aria-label='Sections'] a:hover { background: var(--surface-2); }
  nav[aria-label='Sections'] a[aria-current='page'] { background: var(--accent-doux); color: var(--accent); font-weight: 600; }

  .basse {
    position: fixed;
    inset: auto 0 0 0;
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 2px;
    background: var(--surface);
    border-top: 1px solid var(--bordure);
    padding: 6px 4px calc(6px + env(safe-area-inset-bottom));
    z-index: 20;
  }
  .basse a, .basse button {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 4px 2px;
    font-size: 0.7rem;
    text-align: center;
    color: var(--encre-douce);
    text-decoration: none;
    background: none;
    border: 0;
    border-radius: var(--rayon-petit);
    font-family: inherit;
    cursor: pointer;
  }
  .basse a[aria-current='page'] { color: var(--accent); font-weight: 650; }

  .tiroir {
    position: fixed;
    inset: auto 8px 76px 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 25;
  }
  .tiroir a { text-decoration: none; }

  /* À partir de 900 px l'écran a la place d'une barre latérale permanente. */
  @media (min-width: 900px) {
    .coque { display: grid; grid-template-columns: 264px 1fr; gap: 24px; align-items: start; }
    .laterale {
      display: flex;
      flex-direction: column;
      gap: 12px;
      position: sticky;
      top: 0;
      height: 100vh;
      padding: 20px 12px;
      overflow-y: auto;
      border-right: 1px solid var(--bordure);
    }
    main { padding: 28px 24px 48px; }
    .basse, .tiroir { display: none; }
  }
</style>
