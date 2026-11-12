<script lang="ts">
  import { onMount } from 'svelte'
  import { longDate, timeOf, shortDate } from '@ecole2recte/protocol'
  import type { PageData } from './$types'
  let { data }: { data: PageData } = $props()
  onMount(() => { window.print() })
</script>
<svelte:head><title>Imprimer l’emploi du temps</title></svelte:head>
<div class="impression-edt">
  <div class="commandes"><a href={`/emploi-du-temps?jour=${data.week}`}>Retour à l’emploi du temps</a> <button onclick={() => window.print()}>Imprimer / Enregistrer en PDF</button></div>
  <h1>Emploi du temps · semaine du {shortDate(data.week)} {data.label}</h1>
  <div class="jours">{#each data.days as day}<section><h2>{longDate(day.date)}</h2>{#each day.lessons as lesson}<article><strong>{timeOf(lesson.start)} – {timeOf(lesson.end)}</strong><p>{lesson.exam ? 'Contrôle · ' : ''}{lesson.subject}</p><p>{[lesson.room, lesson.teacher, lesson.group].filter(Boolean).join(' · ')}</p></article>{:else}<p>Aucun cours</p>{/each}</section>{/each}</div>
</div>
<style>
  .jours { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:8px; }
  h1 { font-size:18px; margin:0 0 12px; } h2 { font-size:12px; } article { border:1px solid #aaa; padding:5px; margin-top:5px; break-inside:avoid; } p { margin:2px 0; } .commandes { margin-bottom:16px; }
  @media screen and (max-width:700px) { .jours { grid-template-columns:1fr; } }
  @media print {
    @page { size:A4 landscape; margin:8mm; }
    :global(body) { background:white!important; color:black!important; font-size:9px!important; }
    :global(body *) { visibility:hidden; }
    .impression-edt, .impression-edt * { visibility:visible; }
    .impression-edt { position:absolute; top:0; left:0; width:100%; color:black; font:9px/1.2 sans-serif; }
    .commandes { display:none; }
    .jours { gap:2mm; } h2 { font-size:10px; } article { padding:1mm; margin-top:1mm; }
    :global(.coque), :global(main) { display:block!important; padding:0!important; margin:0!important; }
    :global(.demo), :global(.progression), :global(header), :global(nav), :global(aside) { display:none!important; }
  }
</style>
