import { defineConfig, devices } from '@playwright/test'
import { config as loadEnv } from 'dotenv'

// Load local env so tests and global-setup see Supabase keys + admin credentials.
loadEnv({ path: '.env.local' })

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  // Run serially with a single worker: `next dev` compiles routes on-demand and
  // drops concurrent first-hit requests, so parallel workers cause flaky aborts.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  // One retry absorbs the first-compile latency on a cold dev server.
  retries: 1,
  // Generous per-test timeout to tolerate next dev's first-compile of each route.
  timeout: 90_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  // Provisions the admin account used by the /admin/claims (J5) scan.
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: BASE_URL,
    navigationTimeout: 60_000,
    actionTimeout: 30_000,
    trace: 'retain-on-failure',
  },
  projects: [
    // Default project: runs ALL specs (covers "Chrome desktop" for cross-browser).
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Cross-browser-only projects (Safari engine + emulated mobile 375px).
    // testMatch scopes them to the cross-browser spec so a11y/infra/gates stay
    // chromium-only and don't run 3×.
    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'] },
      testMatch: /cross-browser\.spec\.ts/,
    },
    {
      name: 'chromium-mobile',
      use: {
        browserName: 'chromium',
        ...devices['Pixel 5'],
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
      testMatch: /cross-browser\.spec\.ts/,
    },
  ],
  // Auto-start the dev server, or reuse one already running locally.
  webServer: {
    command: 'pnpm dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
