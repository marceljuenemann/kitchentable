import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'html',
  timeout: 45_000,
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Manages `ng serve` only -- Supabase is Docker-based and slow to boot, and per
  // CLAUDE.md the dev convention is to keep `supabase start` running yourself;
  // Playwright shouldn't try to own that lifecycle.
  webServer: {
    command: 'npm start',
    cwd: 'web',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
