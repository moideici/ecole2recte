<script lang="ts">
  import EnTete from '$lib/components/EnTete.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
</script>

<svelte:head><title>Profil non pris en charge — ecole2recte</title></svelte:head>

<EnTete
  surtitre="Profil"
  titre={data.role === 'teacher' ? 'Compte enseignant' : 'Profil non pris en charge'}
  soustitre={data.nom}
/>

<div class="carte pile">
  {#if data.role === 'teacher'}
    <p>
      Ce compte est reconnu comme un compte enseignant. L’application ne le prend pas encore
      en charge, et c’est délibéré.
    </p>
    <p class="discret">
      Les routes enseignant vivent sur un autre serveur qu’ÉcoleDirecte réserve à ce profil,
      et la documentation publique n’en décrit que la lecture — par une seule source, récente
      et non corroborée. Aucune écriture professeur (saisie de notes, appel, cahier de textes)
      n’est documentée nulle part.
    </p>
    <p class="discret">
      Écrire ce code sans compte enseignant pour le vérifier reviendrait à deviner, et un
      appel manqué ou une note mal saisie ne se rattrapent pas. La place est réservée dans
      l’architecture — l’hôte est prêt, le rôle est reconnu — et le jour où un compte de test
      existe, cela se branche sans refonte.
    </p>
  {:else}
    <p>
      Ce compte n’est ni un compte élève, ni un compte famille avec des enfants lisibles
      (type déclaré : <code>{data.type}</code>).
    </p>
    <p class="discret">
      L’application ne sait pas quoi lui montrer, et préfère le dire plutôt que d’enchaîner
      des « accès refusé » sans explication.
    </p>
  {/if}

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
