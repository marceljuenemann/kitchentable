import { expect, test } from '@playwright/test';
import { signInAs } from './support/admin';

test('redirects an unauthenticated visitor from /app to the landing page', async ({ page }) => {
  await page.goto('/app');
  await page.waitForURL((url) => url.pathname === '/');
  await expect(page.getByRole('heading', { name: /invite-only/ })).toBeVisible();
});

test('redirects an unauthenticated visitor from /admin to the landing page', async ({ page }) => {
  await page.goto('/admin/vetting');
  await page.waitForURL((url) => url.pathname === '/');
});

test('redirects a member from /admin to the app', async ({ page }) => {
  await signInAs(page, 'active');
  await page.goto('/admin/vetting');
  await page.waitForURL('**/app');
  await expect(page.getByRole('heading', { name: 'Hello World' })).toBeHidden();
});

test('redirects an unknown route to the landing page', async ({ page }) => {
  await page.goto('/some-unknown-path');
  await page.waitForURL((url) => url.pathname === '/');
});
