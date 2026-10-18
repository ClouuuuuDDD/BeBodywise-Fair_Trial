// Playwright config. Owner: E7 (tests in e2e/). Run: npm run test:e2e
// Uses the browsers already in the user cache (%LOCALAPPDATA%\ms-playwright). @playwright/test is
// pinned to 1.63.0 because that release matches the cached chromium-1243; don't bump it without
// running `npx playwright install chromium`.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  // Phone widths first: 360 (low-end Android), 390 (design width), plus the 480 px column edge.
  projects: [
    { name: 'android-360', use: { ...devices['Galaxy S9+'], viewport: { width: 360, height: 740 } } },
    { name: 'phone-390', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
    { name: 'column-480', use: { ...devices['Desktop Chrome'], viewport: { width: 480, height: 900 } } },
  ],
  webServer: {
    command: 'npm run build -w app && npm run preview -w app',
    // The shipped build opens in the guided demo; the suite tests the plain app (demo.spec.ts turns it on itself).
    env: { VITE_GUIDED_DEMO: '0' },
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
