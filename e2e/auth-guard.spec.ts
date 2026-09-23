import { expect, test } from '@playwright/test';

test('redirects an unauthenticated visitor from /app to the landing page', async ({ page }) => {
  await page.goto('/app');
  await page.waitForURL((url) => url.pathname === '/');
  await expect(page.getByRole('heading', { name: /invite-only/ })).toBeVisible();
});

test('redirects an unknown route to the landing page', async ({ page }) => {
  await page.goto('/some-unknown-path');
  await page.waitForURL((url) => url.pathname === '/');
});
