import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 240_000, // la première visite de chaque page compile côté serveur de dev
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'téléphone', use: { viewport: { width: 390, height: 844 } } },
    { name: 'ordinateur', use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: 'pnpm --filter @ecole2recte/web dev --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/connexion',
    env: { ED_DEMO: '1' },
    // Un serveur déjà ouvert pourrait utiliser un compte réel ou avoir désactivé la démo.
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
