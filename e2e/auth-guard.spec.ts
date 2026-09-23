import { test } from '@playwright/test';

test('redirects an unauthenticated visitor from /apply to /apply/start', async ({ page }) => {
  await page.goto('/apply');
  await page.waitForURL('**/apply/start');
});

test('redirects an unknown route through /apply to /apply/start', async ({ page }) => {
  await page.goto('/some-unknown-path');
  await page.waitForURL('**/apply/start');
});
