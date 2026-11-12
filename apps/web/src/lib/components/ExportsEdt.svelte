<script lang="ts">
  let { semaine, evenements, alternance }: { semaine: string; evenements: Array<{ uid: string; titre: string }>; alternance: string } = $props()
</script>
<details class="exports-edt">
  <summary>Exporter l’emploi du temps</summary>
  <div class="contenu">
    <a href={`/emploi-du-temps/calendrier.ics?jour=${semaine}`}>Ajouter au calendrier · cette semaine et la suivante</a>
    <a href={`/emploi-du-temps/imprimer?jour=${semaine}`}>Imprimer / PDF · cette semaine</a>
    <form method="POST" action="/emploi-du-temps/alternance">
      <input type="hidden" name="jour" value={semaine} />
      <label>Mon emploi du temps alterne
        <select name="semaine" value={alternance}><option value="">Non</option><option value="A">Oui · la semaine courante est A</option><option value="B">Oui · la semaine courante est B</option></select>
      </label>
      <button type="submit">Enregistrer</button>
      <p>Ce choix personnel étiquette les exports. ÉcoleDirecte ne fournit pas les semaines A/B.</p>
    </form>
    <details><summary>Ajouter un cours ou un contrôle</summary>
      {#each evenements as event}<a href={`/emploi-du-temps/calendrier.ics?jour=${semaine}&evenement=${event.uid}`}>Ajouter au calendrier · {event.titre}</a>{:else}<p>Aucun cours à exporter.</p>{/each}
    </details>
  </div>
</details>
<style>
  .exports-edt { margin-bottom:16px; border:1px solid var(--bordure); border-radius:var(--rayon-petit); padding:12px; } summary { cursor:pointer; } .contenu { display:grid; gap:12px; margin-top:12px; } a { display:block; padding:8px 0; } select { max-width:100%; } form { display:grid; gap:8px; } p { font-size:0.85rem; }
</style>
