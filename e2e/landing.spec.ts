import { expect, test } from '@playwright/test';
import { getLatestMagicLink } from './support/mailpit';
import { uniqueEmail } from './support/test-email';

test('shows the invite-only message with no invite code', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Kitchen Table is currently invite-only' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Email us' })).toBeVisible();
});

test('shows the sign-up form when an invite code is present', async ({ page }) => {
  await page.goto('/?invite=anything');
  await expect(page.getByRole('heading', { name: 'Sign Up' })).toBeVisible();
});

test('completes the full sign-up flow with a valid invite code', async ({ page }) => {
  const email = uniqueEmail();

  await page.goto('/?invite=E2E-FRESH');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Sign up' }).click();

  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

  const link = await getLatestMagicLink(email);
  await page.goto(link);
  await page.waitForURL('**/apply');

  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
});

for (const [scenario, code] of [
  ['an unknown invite code', 'NOT-A-REAL-CODE'],
  ['an exhausted invite code', 'E2E-EXHAUSTED'],
] as const) {
  test(`shows an error for ${scenario}`, async ({ page }) => {
    await page.goto(`/?invite=${code}`);
    await page.getByLabel('Email').fill(uniqueEmail());
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Sign up' }).click();

    // The landing page swallows the specific backend reason into one fixed message --
    // the exact backend error text is covered at the trigger level by
    // supabase/tests/database/invite_codes.test.sql, not here.
    await expect(page.getByText('Invalid invite link, could not create profile.')).toBeVisible();
  });
}
