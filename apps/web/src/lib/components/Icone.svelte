<script module lang="ts">
  /**
   * Les icônes de navigation.
   *
   * Dessinées ici, en traits, plutôt que chargées d'ailleurs : la politique de contenu de
   * l'application n'autorise aucune ressource extérieure, et une icône manquante casserait
   * une barre de navigation entière.
   *
   * Elles sont décoratives : chaque entrée porte déjà son libellé en toutes lettres. Une
   * icône seule ne dirait rien à qui ne la reconnaît pas, et rien du tout à un lecteur
   * d'écran — d'où le `aria-hidden` systématique.
   */
  export type NomIcone =
    | 'accueil'
    | 'calendrier'
    | 'devoirs'
    | 'notes'
    | 'messages'
    | 'vie-scolaire'
    | 'documents'
    | 'actualites'
    | 'manuels'
    | 'stockage'
    | 'reglages'
    | 'classes'
    | 'profil'
    | 'plus'
    | 'sortie'

  const TRACES: Record<NomIcone, string> = {
    accueil: 'M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5M9.5 20v-5.5h5V20',
    calendrier: 'M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4M8 14h3M8 17.5h8',
    devoirs: 'M5 4h9l5 5v11H5zM14 4v5h5M8.5 13.5l2 2 4-4',
    notes: 'M4 20V9M10 20V4M16 20v-7M22 20H2',
    messages: 'M3 6h18v12H3zM3 6.5l9 6.5 9-6.5',
    'vie-scolaire': 'M12 3 4.5 6v6c0 4.5 3.2 7.5 7.5 9 4.3-1.5 7.5-4.5 7.5-9V6zM12 9v4M12 15.5v.5',
    documents: 'M3 6.5h6l2 2.5h10V19H3zM3 6.5V19',
    actualites: 'M4 9.5h4l8-4.5v14l-8-4.5H4zM4 9.5v5.5M17.5 9.5a3 3 0 0 1 0 5',
    manuels: 'M4 5.5c2.5-1 5-1 8 .5 3-1.5 5.5-1.5 8-.5v13c-2.5-1-5-1-8 .5-3-1.5-5.5-1.5-8-.5zM12 6v13',
    stockage: 'M7 18.5a4 4 0 0 1-.4-8A5.5 5.5 0 0 1 17.3 10a3.8 3.8 0 0 1 .3 8.5z',
    reglages:
      'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.5 12a7.5 7.5 0 0 0-.2-1.6l2-1.5-2-3.4-2.3 1a7.5 7.5 0 0 0-2.8-1.6L13.8 2h-3.6l-.4 2.9a7.5 7.5 0 0 0-2.8 1.6l-2.3-1-2 3.4 2 1.5a7.6 7.6 0 0 0 0 3.2l-2 1.5 2 3.4 2.3-1a7.5 7.5 0 0 0 2.8 1.6l.4 2.9h3.6l.4-2.9a7.5 7.5 0 0 0 2.8-1.6l2.3 1 2-3.4-2-1.5c.1-.5.2-1 .2-1.6z',
    classes: 'M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2.5 19.5c0-3 2.7-5 6-5s6 2 6 5M16 5.5a3 3 0 0 1 0 6M17.5 14.8c2.4.5 4 2.3 4 4.7',
    profil: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6',
    plus: 'M5 12h.01M12 12h.01M19 12h.01',
    sortie: 'M14 4h5v16h-5M10 8l-4 4 4 4M6 12h9',
  }
</script>

<script lang="ts">
  let { nom, taille = 20 }: { nom: NomIcone; taille?: number } = $props()
</script>

<svg
  class="icone"
  width={taille}
  height={taille}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.7"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
><path d={TRACES[nom]} /></svg>

<style>
  .icone { flex: none; display: block; }
</style>
