<script lang="ts">
  /**
   * La mascotte : un lapin, deux couleurs.
   *
   * `corps` colore la silhouette, `trait` les détails (l'intérieur des oreilles, les yeux, le
   * nez). Par défaut le corps suit la couleur du texte et le trait celle du fond de marque :
   * sur la barre bleue, un lapin blanc aux traits bleus ; sur un panneau blanc, il suffit de
   * passer `corps="var(--accent)"` et `trait="var(--surface)"`.
   */
  let {
    taille = 40,
    corps = 'currentColor',
    trait = 'var(--lapin-trait)',
    titre = '',
  }: { taille?: number; corps?: string; trait?: string; titre?: string } = $props()
</script>

<svg
  width={taille}
  height={taille}
  viewBox="0 0 64 64"
  role={titre ? 'img' : undefined}
  aria-label={titre || undefined}
  aria-hidden={titre ? undefined : 'true'}
  focusable="false"
>
  <ellipse cx="24" cy="15" rx="6.5" ry="15" transform="rotate(-8 24 15)" fill={corps} />
  <ellipse cx="40" cy="15" rx="6.5" ry="15" transform="rotate(8 40 15)" fill={corps} />
  <ellipse cx="24.4" cy="16" rx="2.8" ry="10" transform="rotate(-8 24.4 16)" fill={trait} />
  <ellipse cx="39.6" cy="16" rx="2.8" ry="10" transform="rotate(8 39.6 16)" fill={trait} />
  <ellipse cx="32" cy="40" rx="19" ry="16.5" fill={corps} />
  <circle cx="25" cy="38" r="2.4" fill={trait} />
  <circle cx="39" cy="38" r="2.4" fill={trait} />
  <ellipse cx="32" cy="43.5" rx="2.8" ry="1.9" fill={trait} />
  <path
    d="M32 45.4v2.2M32 47.6q-3 3-6.2 1M32 47.6q3 3 6.2 1"
    fill="none"
    stroke={trait}
    stroke-width="1.6"
    stroke-linecap="round"
  />
</svg>
