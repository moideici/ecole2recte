<script lang="ts">
  import { enhance } from '$app/forms'
  import type { ActionData, PageData } from './$types'

  let { data, form }: { data: PageData; form: ActionData } = $props()
  let envoi = $state(false)

  // Les propositions affichées sont **exactement** celles du serveur : l'application n'en
  // invente aucune, n'en approche aucune, et ne répond jamais à la place de la personne.
  const propositions = $derived(form && 'propositions' in form ? (form.propositions as string[]) : [])
  const question = $derived(form && 'question' in form ? (form.question as string) : '')
</script>

<svelte:head><title>Connexion — ecole2recte</title></svelte:head>

<h1>ecole2recte</h1>
<p class="discret" style="margin-top:6px">
  Un client ÉcoleDirecte lisible, sur ordinateur comme sur téléphone, pour les élèves, les
  familles et les professeurs.
</p>

{#if form && 'message' in form && form.message}
  <p class="erreur" role="alert" style="margin-top:18px">{form.message}</p>
{/if}

{#if question}
  <form
    method="POST"
    action="?/question"
    class="pile"
    style="margin-top:24px"
    use:enhance={() => {
      envoi = true
      return async ({ update }) => {
        await update()
        envoi = false
      }
    }}
  >
    <fieldset>
      <legend><h2>{question}</h2></legend>
      <p class="discret" style="margin:6px 0 12px">
        ÉcoleDirecte demande cette vérification pour un nouvel appareil. La réponse vient de
        toi : l'application ne la devine pas.
      </p>
      {#each propositions as proposition, index (proposition)}
        <label class="choix">
          <input type="radio" name="choix" value={proposition} required checked={index === 0} />
          <span>{proposition}</span>
        </label>
      {/each}
    </fieldset>
    <button class="bouton primaire" disabled={envoi}>{envoi ? 'Vérification…' : 'Valider'}</button>
  </form>
{:else}
  <form
    method="POST"
    action="?/connexion"
    class="pile"
    style="margin-top:24px"
    use:enhance={() => {
      envoi = true
      return async ({ update }) => {
        await update()
        envoi = false
      }
    }}
  >
    <label class="pile" style="gap:6px">
      <span class="minuscule">Identifiant</span>
      <input class="champ" name="identifiant" autocomplete="username" required autocapitalize="none" />
    </label>
    <label class="pile" style="gap:6px">
      <span class="minuscule">Mot de passe</span>
      <input class="champ" name="motdepasse" type="password" autocomplete="current-password" required />
    </label>
    <button class="bouton primaire" disabled={envoi}>{envoi ? 'Connexion…' : 'Se connecter'}</button>
  </form>

  <p class="discret" style="margin-top:22px">
    Les identifiants servent à la connexion et ne sont pas conservés. Le jeton de session
    reste sur le serveur : le navigateur ne reçoit qu'un identifiant opaque.
  </p>

  {#if data.demo}
    <form method="POST" action="?/demo" class="carte pile demo">
      <p style="font-weight:600">Pas encore de compte branché ?</p>
      <p class="discret">
        L’espace professeur tourne sur des données entièrement inventées : rien ne part vers
        ÉcoleDirecte.
      </p>
      <button class="bouton">Découvrir l’espace professeur</button>
    </form>
  {/if}
{/if}

<style>
  fieldset { border: 0; margin: 0; padding: 0; }
  legend { padding: 0; }
  .choix {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 48px;
    padding: 4px 14px;
    border: 1px solid var(--bordure);
    border-radius: var(--rayon-petit);
    background: var(--surface);
    margin-bottom: 8px;
    cursor: pointer;
  }
  .choix:hover { border-color: var(--accent); }
  .demo { margin-top: 22px; gap: 8px; }
</style>
