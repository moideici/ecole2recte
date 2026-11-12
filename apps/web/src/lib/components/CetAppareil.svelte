<script lang="ts">
  import { enhance } from '$app/forms'

  type Journal = Array<{ at: number; ms: number; page: string; resultat: 'ok' | 'repli' | 'erreur' }>
  let { coffre, journal }: {
    coffre: { present: boolean; derniere: number | null; expireLe: number | null }
    journal: Journal
  } = $props()

  const heure = (t: number) => new Date(t).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
  const jour = (t: number) => new Date(t).toLocaleDateString('fr-FR', { dateStyle: 'long' })
  const LIBELLE = { ok: 'Réussi', repli: 'Données gardées', erreur: 'Erreur' } as const
  const recents = $derived([...journal].reverse())
</script>

<section class="carte" style="margin-bottom:18px">
  <h2>Cet appareil</h2>
  {#if coffre.present}
    <p>
      <strong>Reconnu.</strong> Si la session disparaît, elle se rouvre toute seule : le mot de
      passe et la réponse à la question de sécurité sont gardés chiffrés sur le serveur, jamais
      dans le navigateur.
    </p>
    <ul class="liste">
      <li><span>Dernière réouverture automatique</span><span class="discret">{coffre.derniere ? heure(coffre.derniere) : 'aucune'}</span></li>
      {#if coffre.expireLe}<li><span>Oublié sans usage avant le</span><span class="discret">{jour(coffre.expireLe)}</span></li>{/if}
    </ul>
    <form method="POST" action="?/oublierAppareil" use:enhance style="margin-top:12px">
      <button class="bouton">Oublier cet appareil</button>
    </form>
    <p class="discret" style="margin-top:8px">
      Tu resteras connecté jusqu’à la fin de la session en cours, puis il faudra retaper le mot de passe.
    </p>
  {:else}
    <p>
      Cet appareil n’est pas gardé : une session perdue ramène à la page de connexion. Coche
      « Rester connecté » à ta prochaine connexion pour ne plus rien retaper.
    </p>
  {/if}
</section>

<section class="carte" style="margin-bottom:18px">
  <h2>Journal des chargements</h2>
  {#if recents.length === 0}
    <p class="discret">Rien pour l’instant : les 30 derniers chargements de pages apparaîtront ici.</p>
  {:else}
    <table class="tableau">
      <thead><tr><th scope="col">Heure</th><th scope="col">Page</th><th scope="col">Durée</th><th scope="col">Résultat</th></tr></thead>
      <tbody>
        {#each recents as ligne (ligne.at + ligne.page)}
          <tr>
            <td>{heure(ligne.at)}</td>
            <td>{ligne.page}</td>
            <td>{ligne.ms} ms</td>
            <td>{LIBELLE[ligne.resultat]}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    <p class="discret" style="margin-top:8px">Seule la forme est gardée : pas de date de devoir, pas de nom, pas de note.</p>
  {/if}
</section>

<style>
  .liste { list-style: none; margin: 0; padding: 0; }
  .liste li { display: flex; justify-content: space-between; gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--bordure); }
  .liste li:last-child { border-bottom: 0; }
</style>
