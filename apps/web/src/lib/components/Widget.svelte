<script lang="ts">
  import Cours from '$lib/components/Cours.svelte'
  import Vide from '$lib/components/Vide.svelte'
  import Journee from '$lib/components/Journee.svelte'
  import GrilleSemaine from '$lib/components/GrilleSemaine.svelte'
  import { duration, longDate, relativeDay, relativeTime, shortDate, timeOf } from '@ecole2recte/protocol'
  import { couleurMatiere } from '$lib/matiereCouleur.js'
  import type { PageData } from '../../routes/$types'

  /**
   * Une tuile de l'accueil.
   *
   * Vingt-six formes, un seul composant : l'accueil se compose d'identifiants, et une tuile
   * qui n'est pas dans la disposition n'est pas rendue du tout. Toutes lisent le même
   * `data` — celui que le serveur a chargé pour cette disposition, et pas plus.
   */
  let { id, data }: { id: string; data: PageData } = $props()

  function arrondi(valeur: number | undefined | null): string {
    return valeur === undefined || valeur === null ? '—' : valeur.toFixed(2).replace('.', ',')
  }
  function brut(valeur: number | undefined): string {
    return valeur === undefined ? '—' : String(valeur).replace('.', ',')
  }
  function teinte(matiere: string): string {
    const couleur = couleurMatiere(matiere)
    return `--fond-matiere:${couleur.fond};--encre-matiere:${couleur.encre}`
  }
  function piece(p: { source: string; id: string; name: string; downloadType: string }): string {
    return `/piece-jointe/${p.source}/${p.id}?nom=${encodeURIComponent(p.name)}&type=${encodeURIComponent(p.downloadType)}`
  }

  const tete = $derived(data.enCours ?? data.suivant ?? null)
  const apres = $derived(
    data.coursAffiches.find((cours) => tete !== null && cours.start > tete.start && !cours.canceled) ?? null,
  )
  const bornes = $derived.by(() => {
    const minutes = (i: string) => Number(i.slice(11, 13)) * 60 + Number(i.slice(14, 16))
    const tous = data.coursAffiches
    if (tous.length === 0) return { debut: 8 * 60, fin: 17 * 60 }
    return {
      debut: Math.floor(Math.min(...tous.map((c) => minutes(c.start))) / 60) * 60,
      fin: Math.ceil(Math.max(...tous.map((c) => minutes(c.end))) / 60) * 60,
    }
  })
  const jourDesCours = $derived(
    data.journeeAffichee === data.jour ? 'Aujourd’hui' : relativeDay(data.journeeAffichee, data.jour),
  )
  const echeance = $derived(data.periode?.councilDate ?? data.periode?.end ?? null)
</script>

{#if id === 'maintenant'}
  <section class="panneau">
    <div class="tete-panneau"><h2>{data.enCours ? 'En ce moment' : 'Prochain cours'}</h2></div>
    <div class="corps-panneau pile">
      {#if tete}
        <Cours cours={tete} actuel={data.enCours !== null && data.enCours !== undefined} href={`/devoirs/${data.journeeAffichee}`} />
        {#if data.enCours && data.avancement !== undefined}
          <div class="jauge" role="img" aria-label={`Journée avancée à ${Math.round(data.avancement * 100)} %`}>
            <span style={`width:${Math.round(data.avancement * 100)}%`}></span>
          </div>
        {/if}
        <p class="discret">{relativeTime(tete.start, data.maintenant)}</p>
        {#if apres}
          <p class="suite">
            <span class="discret">puis</span>
            <span class="etiquette-matiere" style={teinte(apres.subject)}>{apres.subject}</span>
            <span class="discret">{timeOf(apres.start)}{apres.room ? ` · ${apres.room}` : ''}</span>
          </p>
        {/if}
      {:else}
        <Vide titre="Plus de cours" description="Rien n’est inscrit dans les jours qui viennent." />
      {/if}
    </div>
  </section>

{:else if id === 'journee'}
  <section class="panneau">
    <div class="tete-panneau">
      <h2>{jourDesCours}</h2>
      <span class="espace"></span>
      <a class="discret" href={`/emploi-du-temps?jour=${data.journeeAffichee}&vue=jour`}>Emploi du temps</a>
    </div>
    <div class="corps-panneau">
      {#if data.coursAffiches.length > 0}
        <Journee
          cours={data.coursAffiches}
          debut={bornes.debut}
          fin={bornes.fin}
          maintenant={data.journeeAffichee === data.jour ? data.maintenant : null}
          lien={`/devoirs/${data.journeeAffichee}`}
        />
      {:else}
        <Vide titre="Pas de cours" description="Rien n’est inscrit à l’emploi du temps." />
      {/if}
    </div>
  </section>

{:else if id === 'salle'}
  <section class="panneau">
    <div class="tete-panneau"><h2>Où aller</h2></div>
    <div class="corps-panneau pile">
      {#if tete}
        <span class="salle-geante" style={teinte(tete.subject)}>{tete.room || '—'}</span>
        <p class="discret">{[tete.subject, timeOf(tete.start), tete.teacher].filter(Boolean).join(' · ')}</p>
      {:else}
        <p class="discret">Aucun cours à venir.</p>
      {/if}
    </div>
  </section>

{:else if id === 'semaine'}
  <section class="panneau">
    <div class="tete-panneau">
      <h2>La semaine</h2>
      <span class="espace"></span>
      <a class="discret" href="/emploi-du-temps">Ouvrir</a>
    </div>
    <div class="corps-panneau">
      <GrilleSemaine
        jours={data.semaineGrille}
        debut={bornes.debut}
        fin={bornes.fin}
        aujourdhui={data.jour}
        lien={(date) => `/emploi-du-temps?jour=${date}&vue=jour`}
        lienCours={(date) => `/devoirs/${date}`}
      />
    </div>
  </section>

{:else if id === 'trous'}
  <section class="panneau">
    <div class="tete-panneau"><h2>Heures libres</h2></div>
    <div class="corps-panneau pile">
      {#each data.trous as trou (trou.start)}
        <p class="rangee">
          <span class="nombre">{timeOf(trou.start)} – {timeOf(trou.end)}</span>
          <span class="espace"></span>
          <span class="jeton">{duration(trou.minutes)}</span>
        </p>
      {:else}
        <p class="discret">Aucun trou {jourDesCours.toLowerCase()}. En deçà de trente minutes, c’est une intercours.</p>
      {/each}
    </div>
  </section>

{:else if id === 'a-faire'}
  <section class="panneau">
    <div class="tete-panneau">
      <h2>À faire</h2>
      <span class="espace"></span>
      <a class="discret" href="/devoirs">Tout voir</a>
    </div>
    <div class="corps-panneau serre">
      {#each data.aFaire as devoir (devoir.id)}
        <a class="ligne" href={`/devoirs/${devoir.dueDate}#${devoir.id}`} style={teinte(devoir.subject)}>
          <span class="filet" aria-hidden="true"></span>
          <span class="ligne-texte">
            <span class="rangee" style="gap:6px;flex-wrap:wrap">
              <span class="etiquette-matiere">{devoir.subject}</span>
              <span class="discret">{relativeDay(devoir.dueDate, data.jour)}</span>
              {#if devoir.exam}<span class="jeton alerte">Évaluation</span>{/if}
            </span>
            {#if devoir.content}
              <span class="extrait">{devoir.content}</span>
            {:else}
              <span class="discret">Aucun énoncé saisi.</span>
            {/if}
          </span>
          <span class="chevron" aria-hidden="true">›</span>
        </a>
      {:else}
        <div style="padding:14px"><Vide titre="Rien à faire" description="Tous les devoirs connus sont cochés." /></div>
      {/each}
    </div>
  </section>

{:else if id === 'evaluations'}
  <section class="panneau">
    <div class="tete-panneau"><h2>Évaluations annoncées</h2></div>
    <div class="corps-panneau serre">
      {#each data.evaluations as devoir (devoir.id)}
        <a class="ligne" href={`/devoirs/${devoir.dueDate}#${devoir.id}`} style={teinte(devoir.subject)}>
          <span class="filet" aria-hidden="true"></span>
          <span class="ligne-texte">
            <span class="rangee" style="gap:6px">
              <span class="etiquette-matiere">{devoir.subject}</span>
              <span class="jeton alerte">{relativeDay(devoir.dueDate, data.jour)}</span>
            </span>
            {#if devoir.content}<span class="extrait">{devoir.content}</span>{/if}
          </span>
        </a>
      {:else}
        <div style="padding:14px"><Vide titre="Aucune évaluation" description="Rien n’est annoncé pour l’instant." /></div>
      {/each}
    </div>
  </section>

{:else if id === 'avancement'}
  <section class="panneau">
    <div class="tete-panneau"><h2>Devoirs à venir</h2></div>
    <div class="corps-panneau">
      {#if data.aRendre === 0}
        <p class="discret">Aucun devoir à rendre dans les jours qui viennent.</p>
      {:else}
        <div class="rangee" style="gap:14px">
          <span class="grand nombre">{data.faits}<span class="sur">/{data.aRendre}</span></span>
          <span class="ligne-texte">
            <strong>{data.aRendre - data.faits} restant{data.aRendre - data.faits > 1 ? 's' : ''}</strong>
            <span class="discret">L’état « fait » est celui d’ÉcoleDirecte.</span>
          </span>
        </div>
        <div class="jauge" style="margin-top:10px" role="img" aria-label={`${data.faits} devoirs faits sur ${data.aRendre}`}>
          <span style={`width:${Math.round((data.faits / data.aRendre) * 100)}%`}></span>
        </div>
      {/if}
    </div>
  </section>

{:else if id === 'contenu-seance'}
  <section class="panneau">
    <div class="tete-panneau">
      <h2>Fait en cours</h2>
      <span class="espace"></span>
      <a class="discret" href={`/devoirs/${data.journeeAffichee}`}>La journée</a>
    </div>
    <div class="corps-panneau serre">
      {#each data.seances as seance (seance.id)}
        <article class="ligne" style={teinte(seance.subject)}>
          <span class="filet" aria-hidden="true"></span>
          <span class="ligne-texte">
            <span class="etiquette-matiere">{seance.subject}</span>
            <span class="extrait">{seance.content}</span>
          </span>
        </article>
      {:else}
        <div style="padding:14px">
          <Vide titre="Rien de saisi" description="Aucun professeur n’a rempli le contenu de séance." />
        </div>
      {/each}
    </div>
  </section>

{:else if id === 'moyenne-generale'}
  <section class="panneau">
    <div class="tete-panneau">
      <h2>Moyenne générale</h2>
      <span class="espace"></span>
      {#if data.moyenne.origin === 'recomputed'}
        <span class="jeton accent">Recalculée</span>
      {:else if data.moyenne.origin === 'computed'}
        <span class="jeton">Calculée</span>
      {:else if data.moyenne.origin === 'official'}
        <span class="jeton succes">Bulletin</span>
      {/if}
    </div>
    <div class="corps-panneau">
      <a class="chiffres" href="/notes">
        <span class="grand nombre">{arrondi(data.moyenne.value)}<span class="sur">/20</span></span>
        <span class="reperes">
          <span><span class="minuscule">Classe</span><span class="nombre">{arrondi(data.periode?.classAverage)}</span></span>
          <span><span class="minuscule">Mini</span><span class="nombre">{arrondi(data.periode?.minimum)}</span></span>
          <span><span class="minuscule">Maxi</span><span class="nombre">{arrondi(data.periode?.maximum)}</span></span>
        </span>
      </a>
      {#if data.moyenne.origin === 'recomputed' && data.moyenne.behind[0]}
        <p class="discret" style="margin-top:8px">
          Le bulletin publie {arrondi(data.moyenne.official)}, calculée avant
          {data.moyenne.behind[0].subject}{data.moyenne.behind[0].date ? ` du ${shortDate(data.moyenne.behind[0].date)}` : ''}.
        </p>
      {/if}
    </div>
  </section>

{:else if id === 'dernieres-notes'}
  <section class="panneau">
    <div class="tete-panneau">
      <h2>Dernières notes</h2>
      <span class="espace"></span>
      <a class="discret" href="/notes">Tout voir</a>
    </div>
    <div class="corps-panneau serre">
      {#each data.derniers as note (note.id)}
        <a class="ligne" href={`/notes#note-${note.id}`} style={teinte(note.subject)}>
          <span class="filet" aria-hidden="true"></span>
          <span class="ligne-texte">
            <span class="etiquette-matiere">{note.subject}</span>
            <span class="discret">{[note.label || 'Évaluation', note.date ? shortDate(note.date) : ''].filter(Boolean).join(' · ')}</span>
          </span>
          <span class="note-valeur nombre">
            {brut(note.value)}<span class="sur">/{note.scale}</span>
          </span>
        </a>
      {:else}
        <div style="padding:14px"><Vide titre="Aucune note" description="Rien n’a encore été saisi." /></div>
      {/each}
    </div>
  </section>

{:else if id === 'moyennes-matieres'}
  <section class="panneau">
    <div class="tete-panneau">
      <h2>Par matière</h2>
      <span class="espace"></span>
      <a class="discret" href="/notes">Le relevé</a>
    </div>
    <div class="corps-panneau">
      {#each data.matieres as matiere (matiere.subject)}
        <div class="barre" style={teinte(matiere.subject)}>
          <span class="barre-nom">{matiere.subject}</span>
          <span class="piste-barre">
            <span class="moi" style={`width:${(matiere.moyenne / 20) * 100}%`}></span>
            {#if matiere.classe !== null}
              <!-- Le trait vertical marque la classe : une moyenne sans repère ne dit rien. -->
              <span class="marque-classe" style={`left:${(matiere.classe / 20) * 100}%`}></span>
            {/if}
          </span>
          <span class="barre-val nombre">{arrondi(matiere.moyenne)}</span>
        </div>
      {:else}
        <Vide titre="Aucune moyenne" description="Rien n’est encore calculable pour cette période." />
      {/each}
      {#if data.matieres.length > 0}
        <p class="discret" style="margin-top:8px">Le trait vertical marque la moyenne de la classe.</p>
      {/if}
    </div>
  </section>

{:else if id === 'progression'}
  <section class="panneau">
    <div class="tete-panneau"><h2>Progression</h2></div>
    <div class="corps-panneau">
      {#if data.progression.length > 1}
        <div class="progression">
          {#each data.progression as periode, index (periode.nom)}
            <div class="etape">
              <span class="nombre valeur-etape">{arrondi(periode.valeur)}</span>
              <span class="colonne-etape" style={`height:${Math.max(6, (periode.valeur / 20) * 88)}px`}></span>
              <span class="minuscule">{periode.nom}</span>
              {#if index === data.progression.length - 1}<span class="jeton accent">actuelle</span>{/if}
            </div>
          {/each}
        </div>
      {:else}
        <p class="discret">Une seule période notée : il n’y a pas encore de progression à montrer.</p>
      {/if}
    </div>
  </section>

{:else if id === 'simulateur'}
  <section class="panneau">
    <div class="tete-panneau"><h2>Simuler une note</h2></div>
    <div class="corps-panneau">
      <form method="GET" action="/notes" class="rangee" style="flex-wrap:wrap;gap:8px">
        <label class="pile" style="gap:4px;flex:1;min-width:150px">
          <span class="minuscule">Matière</span>
          <select class="champ" name="matiere">
            {#each data.matieres as matiere (matiere.subject)}
              <option value={matiere.subject}>{matiere.subject}</option>
            {/each}
          </select>
        </label>
        <label class="pile" style="gap:4px;width:104px">
          <span class="minuscule">Note</span>
          <input class="champ" name="note" type="number" min="0" max="20" step="0.25" />
        </label>
        <button class="bouton primaire" style="align-self:flex-end">Calculer</button>
      </form>
      <p class="discret" style="margin-top:8px">Le résultat s’ouvre sur la page des notes, avec l’effet sur la générale.</p>
    </div>
  </section>

{:else if id === 'appreciation'}
  <section class="panneau">
    <div class="tete-panneau"><h2>Conseil de classe</h2></div>
    <div class="corps-panneau">
      {#if data.periode?.appreciation}
        <p>{data.periode.appreciation}</p>
        <p class="discret" style="margin-top:6px">
          {[data.periode.headTeacher, data.periode.councilDate ? longDate(data.periode.councilDate) : ''].filter(Boolean).join(' · ')}
        </p>
      {:else}
        <p class="discret">Aucune appréciation publiée pour {data.periode?.name ?? 'cette période'}.</p>
      {/if}
    </div>
  </section>

{:else if id === 'absences'}
  <section class="panneau">
    <div class="tete-panneau">
      <h2>Vie scolaire</h2>
      <span class="espace"></span>
      {#if data.absences > 0}<span class="jeton erreur-jeton">À justifier</span>{/if}
    </div>
    <div class="corps-panneau">
      <a class="chiffres" href="/vie-scolaire">
        <span class="grand nombre" class:rouge={data.absences > 0}>{data.absences}</span>
        <span class="ligne-texte">
          <strong>absence{data.absences > 1 ? 's' : ''} non justifiée{data.absences > 1 ? 's' : ''}</strong>
          <span class="discret">{data.vieScolaire.length} événement{data.vieScolaire.length > 1 ? 's' : ''} depuis la rentrée</span>
        </span>
      </a>
    </div>
  </section>

{:else if id === 'encouragements'}
  <section class="panneau">
    <div class="tete-panneau"><h2>Du conseil</h2></div>
    <div class="corps-panneau serre">
      {#each data.vieScolaire.filter((entree) => entree.kind === 'encouragement' || entree.kind === 'sanction') as entree (entree.id)}
        <article class="ligne">
          <span class="filet" aria-hidden="true" style={`--encre-matiere:${entree.kind === 'sanction' ? 'var(--erreur)' : 'var(--succes)'}`}></span>
          <span class="ligne-texte">
            <span class={entree.kind === 'sanction' ? 'jeton erreur-jeton' : 'jeton succes'}>{entree.label}</span>
            <span class="discret">{longDate(entree.start)}</span>
            {#if entree.comment}<span class="extrait">{entree.comment}</span>{/if}
          </span>
        </article>
      {:else}
        <div style="padding:14px"><Vide titre="Rien à signaler" description="Ni sanction ni encouragement." /></div>
      {/each}
    </div>
  </section>

{:else if id === 'messages'}
  <section class="panneau">
    <div class="tete-panneau">
      <h2>Messages</h2>
      <span class="espace"></span>
      <a class="discret" href="/messages">Tout voir</a>
    </div>
    <div class="corps-panneau serre">
      {#each data.nonLus as message (message.id)}
        <a class="ligne" href={`/messages/${message.id}`}>
          <span class="filet accent" aria-hidden="true"></span>
          <span class="ligne-texte">
            <span style="font-weight:600">{message.sender}</span>
            <span class="discret">{message.subject}</span>
          </span>
        </a>
      {:else}
        <div style="padding:14px"><Vide titre="Tout est lu" /></div>
      {/each}
    </div>
  </section>

{:else if id === 'actualites'}
  <section class="panneau">
    <div class="tete-panneau">
      <h2>Actualités</h2>
      <span class="espace"></span>
      <a class="discret" href="/actualites">Tout voir</a>
    </div>
    <div class="corps-panneau">
      {#each data.actualites as actualite (actualite.id)}
        <p style="font-weight:600">{actualite.title}</p>
        {#if actualite.content}<p class="extrait" style="margin-top:2px">{actualite.content}</p>{/if}
        <p class="discret" style="margin:6px 0 14px">
          {[actualite.author, actualite.date ? longDate(actualite.date) : ''].filter(Boolean).join(' · ')}
        </p>
      {:else}
        <p class="discret">Rien n’a été publié, ou le module est fermé.</p>
      {/each}
    </div>
  </section>

{:else if id === 'documents'}
  <section class="panneau">
    <div class="tete-panneau">
      <h2>Documents</h2>
      <span class="espace"></span>
      <a class="discret" href="/documents">Tout voir</a>
    </div>
    <div class="corps-panneau serre">
      {#each data.documents as document (document.id)}
        <a class="ligne" href={`/piece-jointe/resource/${document.id}?nom=${encodeURIComponent(document.name)}&type=${encodeURIComponent(document.type)}`}>
          <span class="filet accent" aria-hidden="true"></span>
          <span class="ligne-texte">
            <span style="font-weight:600">{document.name}</span>
            {#if document.date}<span class="discret">{longDate(document.date)}</span>{/if}
          </span>
        </a>
      {:else}
        <div style="padding:14px"><Vide titre="Aucun document" /></div>
      {/each}
    </div>
  </section>

{:else if id === 'manuels'}
  <section class="panneau">
    <div class="tete-panneau">
      <h2>Manuels</h2>
      <span class="espace"></span>
      <a class="discret" href="/manuels">Tout voir</a>
    </div>
    <div class="corps-panneau pile">
      {#each data.manuels as manuel (manuel.id)}
        {#if manuel.url}
          <!-- Le manuel s'ouvre chez son éditeur : `noopener` pour ne pas lui donner la main. -->
          <a class="rangee" href={manuel.url} target="_blank" rel="noopener noreferrer" style="text-decoration:none;color:inherit">
            <span class="etiquette-matiere" style={teinte(manuel.subject || manuel.title)}>{manuel.title}</span>
            <span class="espace"></span><span class="discret">↗</span>
          </a>
        {:else}
          <span class="etiquette-matiere" style={teinte(manuel.subject || manuel.title)}>{manuel.title}</span>
        {/if}
      {:else}
        <p class="discret">Aucun manuel associé à ce compte.</p>
      {/each}
    </div>
  </section>

{:else if id === 'stockage'}
  <section class="panneau">
    <div class="tete-panneau">
      <h2>Fichiers récents</h2>
      <span class="espace"></span>
      <a class="discret" href="/cloud">Tout voir</a>
    </div>
    <div class="corps-panneau serre">
      {#each data.fichiers as fichier (fichier.id)}
        <a class="ligne" href={`/piece-jointe/resource/${fichier.id}?nom=${encodeURIComponent(fichier.name)}&type=CLOUD`}>
          <span class="filet accent" aria-hidden="true"></span>
          <span class="ligne-texte">
            <span style="font-weight:600">{fichier.name}</span>
            {#if fichier.folder}<span class="discret">{fichier.folder}</span>{/if}
          </span>
        </a>
      {:else}
        <div style="padding:14px"><Vide titre="Aucun fichier" /></div>
      {/each}
    </div>
  </section>

{:else if id === 'profil'}
  <section class="panneau">
    <div class="tete-panneau"><h2>Ma scolarité</h2></div>
    <div class="corps-panneau pile">
      <a class="rangee" href="/profil" style="text-decoration:none;color:inherit">
        <span class="pastille-profil" aria-hidden="true">{data.profil?.initiales ?? '?'}</span>
        <span class="ligne-texte">
          <strong>{data.profil?.nom ?? ''}</strong>
          <span class="discret">{data.profil?.classe ?? ''}</span>
        </span>
      </a>
      <p class="discret">
        {[data.profil?.etablissement, data.periode?.headTeacher ? `professeur principal ${data.periode.headTeacher}` : '']
          .filter(Boolean)
          .join(' · ')}
      </p>
    </div>
  </section>

{:else if id === 'echeance'}
  <section class="panneau">
    <div class="tete-panneau"><h2>Prochaine échéance</h2></div>
    <div class="corps-panneau pile">
      {#if echeance}
        <span class="grand">{relativeDay(echeance, data.jour)}</span>
        <p class="discret">
          {data.periode?.councilDate ? 'Conseil de classe' : 'Fin de période'} · {longDate(echeance)}{data.periode?.councilTime ? ` à ${data.periode.councilTime}` : ''}
        </p>
      {:else}
        <p class="discret">Aucune date de conseil ni de fin de période n’est publiée.</p>
      {/if}
    </div>
  </section>

{:else if id === 'raccourcis'}
  <section class="panneau">
    <div class="tete-panneau"><h2>Aller à</h2></div>
    <div class="corps-panneau">
      <div class="raccourcis">
        <a href="/emploi-du-temps">Emploi du temps</a>
        <a href="/devoirs">Travail</a>
        <a href="/notes">Notes</a>
        <a href="/messages">Messages</a>
        <a href="/vie-scolaire">Vie scolaire</a>
        <a href="/cloud">Stockage</a>
      </div>
    </div>
  </section>
{/if}

<style>
  .suite {
    display: flex;
    align-items: center;
    gap: 7px;
    flex-wrap: wrap;
    padding-top: 9px;
    border-top: 1px solid var(--bordure-douce);
  }

  .ligne {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 14px 9px 0;
    border-bottom: 1px solid var(--bordure-douce);
    text-decoration: none;
    color: inherit;
  }
  .ligne:last-child { border-bottom: 0; }
  a.ligne:hover { background: var(--surface-2); }
  .filet {
    width: 5px;
    align-self: stretch;
    min-height: 34px;
    background: var(--encre-matiere, var(--accent));
    border-radius: 0 3px 3px 0;
    flex: none;
  }
  .filet.accent { background: var(--accent); }
  .ligne-texte { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; align-items: flex-start; }
  .chevron { color: var(--encre-douce); font-size: 1.3rem; flex: none; }
  .note-valeur { font-weight: 700; font-size: 1.15rem; }
  .extrait {
    color: var(--encre-douce);
    font-size: 0.86rem;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .chiffres { display: flex; align-items: center; gap: 18px; text-decoration: none; color: inherit; flex-wrap: wrap; }
  .grand { font-size: 2.2rem; font-weight: 700; line-height: 1; color: var(--accent); }
  .grand.rouge { color: var(--erreur); }
  .sur { font-size: 0.45em; color: var(--encre-douce); font-weight: 600; }
  .reperes { display: flex; gap: 16px; }
  .reperes > span { display: flex; flex-direction: column; gap: 1px; }
  .reperes .nombre { font-weight: 650; }

  .jauge { height: 6px; background: var(--surface-2); border-radius: 999px; overflow: hidden; }
  .jauge span { display: block; height: 100%; background: var(--accent); }

  .salle-geante { font-size: 2.6rem; font-weight: 700; line-height: 1; color: var(--encre-matiere); }

  /* — les barres par matière */
  .barre { display: grid; grid-template-columns: minmax(78px, 1.1fr) 1fr auto; gap: 10px; align-items: center; margin-bottom: 9px; }
  .barre:last-of-type { margin-bottom: 0; }
  .barre-nom { font-size: 0.84rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .piste-barre { position: relative; height: 12px; border-radius: 999px; background: var(--surface-3); }
  .piste-barre .moi { position: absolute; inset: 0 auto 0 0; border-radius: 999px; background: var(--encre-matiere); }
  .piste-barre .marque-classe { position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--encre); opacity: 0.55; }
  .barre-val { font-weight: 650; font-size: 0.86rem; min-width: 2.9rem; text-align: right; }

  /* — la progression, une colonne par période */
  .progression { display: flex; align-items: flex-end; gap: 14px; }
  .etape { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .valeur-etape { font-weight: 700; font-size: 0.95rem; }
  .colonne-etape { width: 100%; max-width: 46px; background: var(--accent); border-radius: 5px 5px 0 0; }
  .etape:last-child .colonne-etape { background: var(--accent-fort); }

  .pastille-profil {
    display: inline-grid;
    place-items: center;
    width: 40px;
    height: 40px;
    flex: none;
    border-radius: 999px;
    background: var(--accent);
    color: var(--accent-encre);
    font-weight: 700;
  }

  .raccourcis { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .raccourcis a {
    display: grid;
    place-items: center;
    min-height: 44px;
    padding: 4px;
    border-radius: var(--rayon-petit);
    border: 1px solid var(--bordure);
    background: var(--surface-2);
    color: var(--encre);
    text-decoration: none;
    font-size: 0.82rem;
    font-weight: 600;
    text-align: center;
  }
  .raccourcis a:hover { border-color: var(--accent); color: var(--accent); }
</style>
