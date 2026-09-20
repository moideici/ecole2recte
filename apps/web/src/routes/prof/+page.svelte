<script lang="ts">
  import EnTete from '$lib/components/EnTete.svelte'
  import Cours from '$lib/components/Cours.svelte'
  import Vide from '$lib/components/Vide.svelte'
  import ErreurSection from '$lib/components/ErreurSection.svelte'
  import { listStamp, longDate, relativeDay, relativeTime } from '@ecole2recte/protocol'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()

  const coursDuJour = $derived(data.duJour.filter((cours) => !cours.canceled).length)
</script>

<svelte:head><title>Accueil — ecole2recte</title></svelte:head>

<EnTete
  surtitre={longDate(data.jour)}
  titre={`Bonjour ${data.prenom}`}
  soustitre={coursDuJour === 0 ? 'Pas de cours aujourd’hui' : `${coursDuJour} cours aujourd’hui`}
/>

<div class="colonnes">
  <section class="pile" aria-labelledby="titre-cours">
    <h2 id="titre-cours">{data.enCours ? 'En ce moment' : 'Prochain cours'}</h2>
    {#if data.erreurs.edt}
      <ErreurSection message="L’emploi du temps n’a pas pu être chargé." cause={data.erreurs.edt} />
    {:else if data.enCours}
      <Cours cours={data.enCours} actuel />
    {:else if data.suivant}
      <Cours cours={data.suivant} />
      <p class="discret">
        {relativeDay(data.suivant.start.slice(0, 10), data.jour)} · {relativeTime(data.suivant.start, data.maintenant)}
      </p>
    {:else}
      <Vide titre="Rien à l’horizon" description="Aucun cours dans les deux semaines qui viennent." />
    {/if}

    {#if data.duJour.length > 0}
      <h2 style="margin-top:12px">Aujourd’hui</h2>
      {#each data.duJour as cours (cours.id)}
        <Cours {cours} actuel={data.enCours?.id === cours.id} />
      {/each}
    {:else if data.prochaineJournee}
      <h2 style="margin-top:12px">{relativeDay(data.prochaineJournee, data.jour)}</h2>
      {#each data.prochainsCours as cours (cours.id)}
        <Cours {cours} />
      {/each}
    {/if}
    <a class="pastille" href="/prof/emploi-du-temps" style="align-self:flex-start">Toute la semaine</a>
  </section>

  <section class="pile" aria-labelledby="titre-messages">
    <h2 id="titre-messages">
      {data.nonLusTotal === 0
        ? 'Messages'
        : `${data.nonLusTotal} message${data.nonLusTotal > 1 ? 's' : ''} non lu${data.nonLusTotal > 1 ? 's' : ''}`}
    </h2>
    {#if data.erreurs.messages}
      <ErreurSection message="La messagerie n’a pas pu être chargée." cause={data.erreurs.messages} />
    {:else}
      {#each data.nonLus as message (message.id)}
        <a class="carte" href={`/prof/messages/${message.id}`}>
          <p style="font-weight:600">{message.interlocuteur}</p>
          <p class="discret">{message.subject}{message.date ? ` · ${listStamp(message.date, data.jour)}` : ''}</p>
        </a>
      {:else}
        <p class="carte discret">Tout est lu.</p>
      {/each}
    {/if}
    <a class="pastille" href="/prof/messages" style="align-self:flex-start">Ouvrir la messagerie</a>

    <h2 style="margin-top:12px">Vos classes</h2>
    <div class="rangee" style="flex-wrap:wrap;gap:8px">
      {#each data.classes as classe (classe.cle)}
        <a class="pastille" href={`/prof/classes/${classe.cle}`}>{classe.libelle}</a>
      {:else}
        <p class="discret">Aucune classe n’est déclarée par le profil de connexion.</p>
      {/each}
    </div>
  </section>
</div>

<style>
  .colonnes { display: grid; gap: 22px; }
  @media (min-width: 900px) { .colonnes { grid-template-columns: 3fr 2fr; align-items: start; } }
  a.carte { text-decoration: none; }
</style>
