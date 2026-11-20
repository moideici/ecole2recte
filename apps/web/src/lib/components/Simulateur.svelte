<script lang="ts">
  import { simulateScenario, type Grade, type GradeTweak, type SubjectVerdict } from '@ecole2recte/protocol'
  import { couleurMatiere } from '$lib/matiereCouleur.js'

  interface Matiere {
    subject: string
    verdict: SubjectVerdict['verdict']
    notes: Grade[]
    [cle: string]: unknown
  }

  let { matieres, notes, periode }: { matieres: Matiere[]; notes: Grade[]; periode: string } = $props()

  interface Ajout {
    cle: number
    subject: string
    valeur: string
    bareme: string
    coefficient: string
  }

  let suivant = 1
  let ajouts = $state<Ajout[]>([])
  let reglages = $state<Record<string, GradeTweak>>({})
  let ouvert = $state(matieres[0]?.subject ?? '')

  function lire(texte: string): number | undefined {
    const lu = Number(texte.replace(',', '.'))
    return texte.trim() !== '' && Number.isFinite(lu) ? lu : undefined
  }

  function ajouter() {
    ajouts.push({ cle: suivant++, subject: matieres[0]?.subject ?? '', valeur: '', bareme: '20', coefficient: '1' })
  }

  function retirer(cle: number) {
    ajouts = ajouts.filter((ajout) => ajout.cle !== cle)
  }

  function toutEffacer() {
    ajouts = []
    reglages = {}
  }

  function regler(id: string, changement: GradeTweak) {
    const suite = { ...reglages[id], ...changement }
    if (suite.ignored !== true && suite.coefficient === undefined) delete reglages[id]
    else reglages[id] = suite
  }

  const valides = $derived(
    ajouts.flatMap((ajout) => {
      const valeur = lire(ajout.valeur)
      const bareme = lire(ajout.bareme) ?? 20
      const coefficient = lire(ajout.coefficient) ?? 1
      if (valeur === undefined || bareme <= 0 || valeur < 0 || valeur > bareme || coefficient <= 0) return []
      return [{ subject: ajout.subject, value: valeur, scale: bareme, coefficient }]
    }),
  )

  const verdicts = $derived(matieres.map((m) => ({ average: m as unknown as SubjectVerdict['average'], verdict: m.verdict })))
  const scenario = $derived(simulateScenario(notes, periode, verdicts, valides, reglages))
  const modifie = $derived(ajouts.length > 0 || Object.keys(reglages).length > 0)

  function arrondi(valeur: number | undefined | null): string {
    return valeur === undefined || valeur === null ? '—' : valeur.toFixed(2).replace('.', ',')
  }

  function ecart(valeur: number | undefined): string {
    if (valeur === undefined) return ''
    return (valeur >= 0 ? '+' : '') + valeur.toFixed(2).replace('.', ',')
  }

  function reelles(nom: string): Grade[] {
    return notes.filter((n) => n.subject === nom && n.counted && n.value !== undefined)
  }
</script>

<section class="panneau" style="margin-top:18px" aria-labelledby="t-simul">
  <div class="tete-panneau">
    <h2 id="t-simul">Simulation</h2>
    <span class="espace"></span>
    {#if modifie}<button type="button" class="bouton discret-bouton" onclick={toutEffacer}>Tout effacer</button>{/if}
  </div>
  <div class="corps-panneau">
    {#if ajouts.length > 0}
      <ul class="lignes">
        {#each ajouts as ajout (ajout.cle)}
          <li class="ligne">
            <label class="pile" style="gap:4px;flex:1;min-width:150px">
              <span class="minuscule">Matière</span>
              <select class="champ" bind:value={ajout.subject}>
                {#each matieres as m (m.subject)}<option value={m.subject}>{m.subject}</option>{/each}
              </select>
            </label>
            <label class="pile" style="gap:4px;width:84px">
              <span class="minuscule">Note</span>
              <input class="champ" inputmode="decimal" bind:value={ajout.valeur} placeholder="14" />
            </label>
            <label class="pile" style="gap:4px;width:72px">
              <span class="minuscule">Sur</span>
              <input class="champ" inputmode="decimal" bind:value={ajout.bareme} />
            </label>
            <label class="pile" style="gap:4px;width:72px">
              <span class="minuscule">Coef.</span>
              <input class="champ" inputmode="decimal" bind:value={ajout.coefficient} />
            </label>
            <button type="button" class="bouton discret-bouton" aria-label="Retirer cette note" onclick={() => retirer(ajout.cle)}>✕</button>
          </li>
        {/each}
      </ul>
    {/if}

    <button type="button" class="bouton primaire" onclick={ajouter}>+ Ajouter une note</button>

    <details class="existantes">
      <summary>Modifier les notes existantes</summary>
      <label class="pile" style="gap:4px;max-width:260px;margin:10px 0">
        <span class="minuscule">Matière</span>
        <select class="champ" bind:value={ouvert}>
          {#each matieres as m (m.subject)}<option value={m.subject}>{m.subject}</option>{/each}
        </select>
      </label>
      <ul class="lignes">
        {#each reelles(ouvert) as note (note.id)}
          {@const reglage = reglages[note.id]}
          <li class="ligne" class:ecartee={reglage?.ignored}>
            <span class="nom">{note.label || 'Devoir'}</span>
            <span class="nombre">{note.value}/{note.scale}</span>
            <label class="pile" style="gap:4px;width:72px">
              <span class="minuscule">Coef.</span>
              <input
                class="champ"
                inputmode="decimal"
                value={reglage?.coefficient ?? note.coefficient}
                onchange={(e) => {
                  const lu = lire(e.currentTarget.value)
                  regler(note.id, { coefficient: lu !== undefined && lu > 0 && lu !== note.coefficient ? lu : undefined })
                }}
              />
            </label>
            <label class="case">
              <input type="checkbox" checked={!reglage?.ignored} onchange={(e) => regler(note.id, { ignored: !e.currentTarget.checked })} />
              Compter
            </label>
          </li>
        {/each}
      </ul>
    </details>

    {#if modifie}
      <div class="resultat" role="status">
        {#each scenario.subjects as ligne (ligne.subject)}
          {@const ton = couleurMatiere(ligne.subject)}
          <p class="matiere" style={`--encre-matiere:${ton.encre}`}>
            <strong>{ligne.subject}</strong>
            <span class="nombre">{arrondi(ligne.before)} → <strong>{arrondi(ligne.after)}</strong></span>
            <span class="discret nombre">{ecart(ligne.delta)}</span>
          </p>
        {/each}
        {#if scenario.subjects.length === 0}
          <p class="discret">Saisissez une note pour voir l’effet.</p>
        {:else}
          <p class="generale-ligne">
            <strong>Moyenne générale</strong>
            <span class="nombre">{arrondi(scenario.generalBefore)} → <strong>{arrondi(scenario.generalAfter)}</strong></span>
            <span class="discret nombre">{ecart(scenario.generalDelta)}</span>
          </p>
        {/if}
      </div>
    {/if}
  </div>
</section>

<style>
  .lignes { list-style: none; margin: 0 0 12px; padding: 0; display: grid; gap: 10px; }
  .ligne { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; }
  .ligne.ecartee .nom,
  .ligne.ecartee .nombre { text-decoration: line-through; opacity: 0.55; }
  .nom { flex: 1; min-width: 120px; }
  .case { display: flex; align-items: center; gap: 6px; padding-bottom: 8px; }
  .existantes { margin-top: 14px; }
  .existantes summary { cursor: pointer; }
  .resultat {
    margin-top: 16px;
    padding: 12px 14px;
    border-radius: var(--rayon-petit);
    background: var(--surface-douce, rgba(127, 127, 127, 0.1));
    display: grid;
    gap: 6px;
  }
  .resultat p { margin: 0; display: flex; flex-wrap: wrap; gap: 10px; align-items: baseline; }
  .matiere strong { color: var(--encre-matiere); }
  .generale-ligne { margin-top: 4px !important; padding-top: 8px; border-top: 1px solid rgba(127, 127, 127, 0.25); }
</style>
