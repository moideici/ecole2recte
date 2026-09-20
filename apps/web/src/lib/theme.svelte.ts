export type Theme = 'systeme' | 'clair' | 'sombre'

export const THEMES: Array<[Theme, string]> = [
  ['systeme', 'Système'],
  ['clair', 'Clair'],
  ['sombre', 'Sombre'],
]

export const LIBELLE_THEME: Record<Theme, string> = {
  systeme: 'Thème du système',
  clair: 'Thème clair',
  sombre: 'Thème sombre',
}

/**
 * Le thème, sur cet appareil.
 *
 * Un seul état, partagé par le bandeau et par la page Réglages : deux contrôles pour un même
 * réglage finissent toujours par se contredire, et c'est celui qu'on regarde qui a l'air
 * cassé. La valeur est déjà posée sur `<html>` par le script d'`app.html`, avant le premier
 * pixel ; on ne fait ici que la relire et la changer.
 *
 * Elle ne quitte jamais l'appareil : le serveur n'a pas à savoir si on lit la nuit.
 */
class Preference {
  valeur = $state<Theme>('systeme')

  /** À appeler une fois monté : avant, `document` n'existe pas côté serveur. */
  relire(): void {
    const pose = document.documentElement.getAttribute('data-theme')
    this.valeur = pose === 'clair' || pose === 'sombre' ? pose : 'systeme'
  }

  appliquer(suivant: Theme): void {
    this.valeur = suivant
    try {
      if (suivant === 'systeme') localStorage.removeItem('e2r-theme')
      else localStorage.setItem('e2r-theme', suivant)
    } catch {
      // Navigation privée, stockage refusé : le choix vaut pour cette visite, et c'est tout.
    }
    if (suivant === 'systeme') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', suivant)
  }

  /** Le tour du bandeau : système → sombre → clair → système. */
  basculer(): void {
    this.appliquer(this.valeur === 'systeme' ? 'sombre' : this.valeur === 'sombre' ? 'clair' : 'systeme')
  }
}

export const theme = new Preference()
