import { expect, test, type Page } from '@playwright/test'

async function sansDebordement(page: Page) {
  await expect.poll(() => page.evaluate(() =>
    Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
      - document.documentElement.clientWidth,
  ), { message: 'La page ne doit pas défiler horizontalement' }).toBeLessThanOrEqual(1)
}

async function naviguer(page: Page, nom: string, secondaire = false) {
  const mobile = page.viewportSize()!.width < 900
  const navigation = page.getByRole('navigation', {
    name: mobile ? 'Sections principales' : 'Sections', exact: true,
  })
  if (mobile && secondaire) {
    await navigation.locator('summary').click()
    await expect(page.getByRole('heading', { name: 'Autres sections' })).toBeVisible()
    await sansDebordement(page)
  }
  await navigation.getByRole('link', { name: nom, exact: true }).click()
}

const sections = [
  { nom: 'Accueil', chemin: '/', titre: 'Bonjour', contenu: 'Première G2' },
  { nom: 'Emploi du temps', chemin: '/emploi-du-temps', titre: 'Emploi du temps', contenu: 'Mathématiques' },
  { nom: 'Travail à faire', chemin: '/devoirs', titre: 'Travail à faire', contenu: 'Mathématiques' },
  { nom: 'Notes', chemin: '/notes', titre: 'Notes', contenu: 'Moyenne générale' },
  { nom: 'Messages', chemin: '/messages', titre: 'Messages', contenu: 'Justificatif d’absence attendu' },
  { nom: 'Vie scolaire', chemin: '/vie-scolaire', titre: 'Absences et retards', contenu: 'Attitude exemplaire en cours.' },
  { nom: 'Documents', chemin: '/documents', titre: 'Documents', contenu: 'Règlement intérieur' },
  { nom: 'Actualités', chemin: '/actualites', titre: 'Actualités', contenu: 'Portes ouvertes du lycée' },
  { nom: 'Manuels', chemin: '/manuels', titre: 'Manuels numériques', contenu: 'Mathématiques 1re' },
  { nom: 'Stockage', chemin: '/cloud', titre: 'Espace de stockage', contenu: 'Exposé SES.odt' },
  { nom: 'Réglages', chemin: '/reglages', titre: 'Réglages', contenu: 'Modules de l’établissement' },
]

for (const apparence of ['clair', 'sombre'] as const) {
  test(`Parcours élève en mode ${apparence}`, async ({ page, context }) => {
    const erreurs: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') erreurs.push(message.text())
    })
    page.on('pageerror', (erreur) => erreurs.push(erreur.message))

    // Toute sortie du navigateur est refusée ; la session démo utilise son moteur local côté serveur.
    await context.route('**/*', async (route) => {
      if (new URL(route.request().url()).origin === 'http://127.0.0.1:4173') {
        await route.continue()
      } else {
        erreurs.push(`Requête externe interdite : ${new URL(route.request().url()).hostname}`)
        await route.abort()
      }
    })

    await page.goto('/connexion')
    await expect(page.getByRole('heading', { name: 'ecole2recte', exact: true })).toBeVisible()
    await sansDebordement(page)
    await page.getByRole('button', { name: 'Voir l’espace élève', exact: true }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('note')).toContainText('données fictives')

    await naviguer(page, 'Réglages', true)
    const choix = page.getByRole('group', { name: 'Apparence', exact: true })
      .getByRole('button', { name: apparence === 'clair' ? 'Clair' : 'Sombre', exact: true })
    await choix.click()
    await expect(choix).toHaveAttribute('aria-pressed', 'true')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', apparence)

    for (const [index, section] of sections.entries()) {
      await test.step(section.nom, async () => {
        await naviguer(page, section.nom, index >= 4)
        await expect(page).toHaveURL(section.chemin)
        await expect(page.getByRole('main').getByRole('heading', {
          level: 1, name: section.titre, exact: true,
        })).toBeVisible()
        await expect(page.getByRole('main').getByText(section.contenu, { exact: false }).first()).toBeVisible()
        await expect(page.locator('html')).toHaveAttribute('data-theme', apparence)
        await sansDebordement(page)

        if (section.chemin === '/emploi-du-temps') {
          const vues = page.getByRole('group', { name: 'Vue', exact: true })
          await vues.getByRole('link', { name: 'Jour', exact: true }).click()
          await expect(vues.getByRole('link', { name: 'Jour', exact: true })).toHaveAttribute('aria-current', 'true')
          await sansDebordement(page)
          await vues.getByRole('link', { name: 'Semaine', exact: true }).click()
          await expect(vues.getByRole('link', { name: 'Semaine', exact: true })).toHaveAttribute('aria-current', 'true')
          await sansDebordement(page)
        }
        if (section.chemin === '/devoirs') {
          await page.getByRole('main').locator('a[href^="/devoirs/"]').first().click()
          await expect(page).toHaveURL(/\/devoirs\/\d{4}-\d{2}-\d{2}/)
          await expect(page.getByRole('heading', { name: 'À faire pour ce jour', exact: true })).toBeVisible()
          await expect(page.getByRole('heading', { name: 'Contenu des séances', exact: true })).toBeVisible()
          await sansDebordement(page)
        }
        if (section.chemin === '/messages') {
          await page.getByRole('link', { name: /Justificatif d’absence attendu/ }).click()
          await expect(page).toHaveURL(/\/messages\/\d+/)
          await expect(page.getByRole('main')).toContainText('Nous attendons un justificatif')
          await sansDebordement(page)
        }
      })
    }

    await page.locator('header summary').click()
    await sansDebordement(page)
    await page.getByRole('link', { name: 'Mon profil', exact: true }).click()
    // Le profil élève renvoie à son accueil ; cette route explique seulement les profils non pris en charge.
    await expect(page).toHaveURL('/')
    await page.locator('header summary').click()
    await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click()
    await expect(page).toHaveURL('/connexion')
    expect(erreurs, 'Aucune erreur console, JavaScript ou requête externe').toEqual([])
  })
}
