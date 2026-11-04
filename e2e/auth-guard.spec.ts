import { expect, Page, test } from '@playwright/test';
import { createUser, signInAs } from './support/admin';
import { getLatestMagicLink } from './support/mailpit';

/** Signs in on the sign-in page with the emailed link, as someone on another device would. */
async function signInWithEmailedLink(page: Page, email: string) {
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  await page.goto(await getLatestMagicLink(email));
}

test('a signed-out visitor to /app is asked to sign in', async ({ page }) => {
  await page.goto('/app');
  await page.waitForURL((url) => url.pathname === '/sign-in');
  expect(new URL(page.url()).searchParams.get('next')).toBe('/app');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('a signed-out visitor to a page of the app gets there once signed in', async ({ page }) => {
  const email = await createUser('active');
  await page.goto('/app/profile');
  await page.waitForURL((url) => url.pathname === '/sign-in');

  await signInWithEmailedLink(page, email);

  await page.waitForURL((url) => url.pathname === '/app/profile');
  await expect(page.getByRole('heading', { name: 'Your profile' })).toBeVisible();
});

test('a signed-out admin gets to the admin tool once signed in', async ({ page }) => {
  const email = await createUser('admin');
  await page.goto('/admin/vetting');
  await page.waitForURL((url) => url.pathname === '/sign-in');
  expect(new URL(page.url()).searchParams.get('next')).toBe('/admin/vetting');

  await signInWithEmailedLink(page, email);

  await page.waitForURL((url) => url.pathname === '/admin/vetting');
});

test('a sign-in link never leads away from Kitchen Table', async ({ page }) => {
  const email = await createUser('active');
  await page.goto(`/sign-in?next=${encodeURIComponent('https://example.com/app')}`);

  await signInWithEmailedLink(page, email);

  await page.waitForURL((url) => url.pathname === '/app');
  expect(new URL(page.url()).origin).toBe('http://localhost:4200');
});

test('a signed-in visitor to the sign-in page goes straight on', async ({ page }) => {
  await signInAs(page, 'active');
  await page.goto(`/sign-in?next=${encodeURIComponent('/app/profile')}`);
  await page.waitForURL((url) => url.pathname === '/app/profile');
});

test('redirects a member from /admin to the app', async ({ page }) => {
  await signInAs(page, 'active');
  await page.goto('/admin/vetting');
  await page.waitForURL('**/app');
  await expect(page.getByText(/applications? waiting/)).toBeHidden();
});

test('redirects an unknown route to the landing page', async ({ page }) => {
  await page.goto('/some-unknown-path');
  await page.waitForURL((url) => url.pathname === '/');
});
