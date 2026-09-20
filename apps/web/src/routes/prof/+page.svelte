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
  <div class="pile" style="gap:18px">
    <section class="panneau" aria-labelledby="titre-cours">
      <div class="tete-panneau"><h2 id="titre-cours">{data.enCours ? 'En ce moment' : 'Prochain cours'}</h2></div>
      <div class="corps-panneau pile">
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
      </div>
    </section>

    {#if data.duJour.length > 0 || data.prochaineJournee}
      <section class="panneau" aria-labelledby="titre-journee">
        <div class="tete-panneau">
          <h2 id="titre-journee">
            {data.duJour.length > 0 ? 'Aujourd’hui' : relativeDay(data.prochaineJournee as string, data.jour)}
          </h2>
          <span class="espace"></span>
          <a class="discret" href="/prof/emploi-du-temps">Toute la semaine</a>
        </div>
        <div class="corps-panneau pile">
          {#each data.duJour.length > 0 ? data.duJour : data.prochainsCours as cours (cours.id)}
            <Cours {cours} actuel={data.enCours?.id === cours.id} />
          {/each}
        </div>
      </section>
    {/if}
  </div>

  <div class="pile" style="gap:18px">
    <section class="panneau" aria-labelledby="titre-messages">
      <div class="tete-panneau">
        <h2 id="titre-messages">
          {data.nonLusTotal === 0
            ? 'Messages'
            : `${data.nonLusTotal} message${data.nonLusTotal > 1 ? 's' : ''} non lu${data.nonLusTotal > 1 ? 's' : ''}`}
        </h2>
        <span class="espace"></span>
        <a class="discret" href="/prof/messages">Ouvrir</a>
      </div>
      <div class="corps-panneau serre">
        {#if data.erreurs.messages}
          <div style="padding:14px">
            <ErreurSection message="La messagerie n’a pas pu être chargée." cause={data.erreurs.messages} />
          </div>
        {:else}
          {#each data.nonLus as message (message.id)}
            <a class="ligne" href={`/prof/messages/${message.id}`}>
              <span class="filet" aria-hidden="true"></span>
              <span class="texte">
                <span style="font-weight:600">{message.interlocuteur}</span>
                <span class="discret">{message.subject}{message.date ? ` · ${listStamp(message.date, data.jour)}` : ''}</span>
              </span>
            </a>
          {:else}
            <p class="discret" style="padding:14px">Tout est lu.</p>
          {/each}
        {/if}
      </div>
    </section>

    <section class="panneau" aria-labelledby="titre-classes">
      <div class="tete-panneau"><h2 id="titre-classes">Vos classes</h2></div>
      <div class="corps-panneau">
        <div class="rangee" style="flex-wrap:wrap;gap:8px">
          {#each data.classes as classe (classe.cle)}
            <a class="pastille" href={`/prof/classes/${classe.cle}`}>{classe.libelle}</a>
          {:else}
            <p class="discret">Aucune classe n’est déclarée par le profil de connexion.</p>
          {/each}
        </div>
      </div>
    </section>
  </div>
</div>

<style>
  .colonnes { display: grid; gap: 18px; align-items: start; }
  @media (min-width: 900px) { .colonnes { grid-template-columns: 3fr 2fr; } }

  .ligne {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px 10px 0;
    border-bottom: 1px solid var(--bordure-douce);
    text-decoration: none;
    color: inherit;
  }
  .ligne:last-child { border-bottom: 0; }
  .ligne:hover { background: var(--surface-2); }
  .filet { width: 5px; align-self: stretch; min-height: 34px; background: var(--accent); border-radius: 0 3px 3px 0; flex: none; }
  .texte { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
</style>
