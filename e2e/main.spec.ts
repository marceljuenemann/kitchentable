import { expect, test } from '@playwright/test';
import { signInAs } from './support/admin';

test('the bottom nav switches between the tabs', async ({ page }) => {
  await signInAs(page, 'active');
  const nav = page.getByRole('navigation', { name: 'Main' });

  // Search is the start.
  await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Search' })).toHaveAttribute('aria-current', 'page');

  for (const [label, path] of [
    ['Your profile', '/app/profile'],
    ['Connections', '/app/connections'],
    ['Messages', '/app/messages'],
    ['Community', '/app/community'],
    ['Search', '/app'],
  ]) {
    await nav.getByRole('link', { name: label }).click();
    await expect(page).toHaveURL(path);
    await expect(page.getByRole('heading', { name: label })).toBeVisible();
    await expect(nav.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
  }
});

test('a tab opens directly by its URL, and an unknown one falls back to Search', async ({
  page,
}) => {
  await signInAs(page, 'active');

  await page.goto('/app/messages');
  await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible();

  await page.goto('/app/nothing-here');
  await expect(page).toHaveURL('/app');
  await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();
});

test('a tab stays current with query parameters in the URL', async ({ page }) => {
  await signInAs(page, 'active');
  const nav = page.getByRole('navigation', { name: 'Main' });

  await page.goto('/app?from=email');
  await expect(nav.getByRole('link', { name: 'Search' })).toHaveAttribute('aria-current', 'page');

  await page.goto('/app/messages?from=email');
  await expect(nav.getByRole('link', { name: 'Messages' })).toHaveAttribute('aria-current', 'page');
});

test('the profile tab has the legal documents and signs out', async ({ page }) => {
  const email = await signInAs(page, 'active');
  await page.goto('/app/profile');

  await page.getByRole('link', { name: 'Privacy Policy' }).click();
  const sheet = page.locator('mat-bottom-sheet-container');
  await expect(sheet.getByRole('heading', { name: 'Kitchen Table Privacy Policy' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();

  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL((url) => url.pathname === '/');
});

test("the tabs' URLs show someone who isn't a member yet their own screen", async ({ page }) => {
  await signInAs(page, 'vetting');

  await page.goto('/app/messages');

  await expect(page.getByRole('heading', { name: 'Thanks for applying' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden();
});
