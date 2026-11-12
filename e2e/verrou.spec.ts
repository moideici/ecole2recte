import { expect, test, type Page } from '@playwright/test'

async function entrerEnDemo(page: Page) {
  await page.goto('/connexion')
  await page.getByRole('button', { name: 'Voir l’espace élève', exact: true }).click()
  await expect(page).toHaveURL('/')
  // Le serveur de dev peut servir la page avant son hydratation : on attend que ce soit fini.
  await page.waitForLoadState('networkidle')
}

test('la présentation s’affiche une fois, se parcourt en trois pages, et ne revient pas', async ({ page }) => {
  await entrerEnDemo(page)
  const fenetre = page.getByRole('dialog', { name: 'Bienvenue' })
  await expect(fenetre).toBeVisible()
  await fenetre.getByRole('button', { name: 'Suivant' }).click()
  await expect(page.getByRole('dialog', { name: 'Notes et travail à faire' })).toBeVisible()
  await page.getByRole('button', { name: 'Suivant' }).click()
  await expect(page.getByRole('dialog', { name: 'Tes données, ton écran' })).toBeVisible()
  await page.getByRole('button', { name: 'C’est parti' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('le verrouillage : posé dans Réglages, il masque tout au rechargement jusqu’au bon code', async ({ page, context }) => {
  await context.addInitScript(() => localStorage.setItem('e2r-presentation', '1'))
  await entrerEnDemo(page)
  await page.goto('/reglages')
  await page.waitForLoadState('networkidle')

  await expect(async () => {
    await page.getByLabel('Code (4 à 6 chiffres)').fill('4821')
    await page.getByLabel('Répéter le code').fill('4821')
    await page.locator('form select').selectOption({ label: 'Immédiatement' })
    await page.getByRole('button', { name: 'Activer le verrouillage' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Verrouillage activé.' })).toBeVisible({ timeout: 2000 })
  }).toPass({ timeout: 20000 })

  // Le code n'est jamais gardé en clair, seulement son haché.
  const garde = await page.evaluate(() => localStorage.getItem('e2r-verrou'))
  expect(garde).not.toContain('4821')

  await page.reload()
  const verrou = page.getByRole('dialog', { name: 'ecole2recte est verrouillée' })
  await expect(verrou).toBeVisible()
  // Le contenu est masqué, pas seulement recouvert.
  await expect(page.getByRole('main')).toBeHidden()

  const champ = verrou.getByLabel('Code de verrouillage')
  await champ.fill('0000')
  await verrou.getByRole('button', { name: 'Déverrouiller' }).click()
  await expect(verrou.getByRole('alert')).toHaveText('Code incorrect.')
  await expect(page.getByRole('main')).toBeHidden()

  await champ.fill('4821')
  await verrou.getByRole('button', { name: 'Déverrouiller' }).click()
  await expect(verrou).toHaveCount(0)
  await expect(page.getByRole('main')).toBeVisible()
})

test('Réglages montre « Cet appareil » et le journal des chargements', async ({ page, context }) => {
  await context.addInitScript(() => localStorage.setItem('e2r-presentation', '1'))
  await entrerEnDemo(page)
  await page.goto('/emploi-du-temps')
  await page.goto('/reglages')
  await expect(page.getByRole('heading', { name: 'Cet appareil', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Journal des chargements' })).toBeVisible()
  // Les pages visitées apparaissent, sans date ni identifiant.
  await expect(page.getByRole('cell', { name: '/emploi-du-temps' }).first()).toBeVisible()
})
