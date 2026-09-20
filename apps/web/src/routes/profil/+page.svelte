<script lang="ts">
  import EnTete from '$lib/components/EnTete.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
</script>

<svelte:head><title>Profil non pris en charge — ecole2recte</title></svelte:head>

<EnTete surtitre="Profil" titre="Profil non pris en charge" soustitre={data.nom} />

<div class="carte pile">
  <p>
    Ce compte n’est ni un compte élève, ni un compte famille avec des enfants lisibles, ni un
    compte enseignant (type déclaré : <code>{data.type}</code>).
  </p>
  <p class="discret">
    L’application ne sait pas quoi lui montrer, et préfère le dire plutôt que d’enchaîner
    des « accès refusé » sans explication.
  </p>

  {#if data.modules.length > 0}
    <p class="discret" style="margin-top:8px">
      Modules déclarés ouverts pour ce compte : {data.modules.join(', ')}.
    </p>
  {/if}

  <form method="POST" action="/deconnexion" style="margin-top:8px">
    <button class="bouton">Se déconnecter</button>
  </form>
</div>

<style>code { background: var(--surface-2); padding: 1px 6px; border-radius: 6px; }</style>
