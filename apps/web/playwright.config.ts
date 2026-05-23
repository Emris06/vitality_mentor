import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for @vitality/web e2e tests.
 *
 * Assumes the Vite dev server is already running at http://localhost:5173.
 * We do NOT spin one up via `webServer` because the user runs it manually.
 *
 * All backend calls go through Vite's `/api` proxy (vite.config.ts), so we
 * intercept `**\/api/**` inside tests to mock the API entirely — the real
 * Fastify backend on :4000 is not needed.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    headless: true,
    // Force English so we can assert against EN strings deterministically.
    locale: 'en-US',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
