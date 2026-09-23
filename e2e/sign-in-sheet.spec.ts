import { expect, Page, test } from '@playwright/test';
import { uniqueEmail } from './support/test-email';

function openSignInSheet(page: Page) {
  return page.locator('.signin-line').getByRole('button', { name: 'Sign in' }).click();
}

/** Creates a real, GoTrue-native user via the landing page's own sign-up flow, without
 *  clicking the magic link -- just enough to exist for a later sign-in test. */
async function createExistingUser(page: Page, email: string) {
  await page.goto('/?invite=E2E-FRESH');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
}

test('shows a fixed error for an email with no existing account', async ({ page }) => {
  await page.goto('/');
  await openSignInSheet(page);

  const sheet = page.locator('.sign-in-sheet');
  await sheet.getByLabel('Email').fill(uniqueEmail());
  await sheet.getByRole('button', { name: 'Sign in' }).click();

  await expect(sheet.getByText('No user with this Email found')).toBeVisible();
});

test('an existing user can request a sign-in link', async ({ page }) => {
  const email = uniqueEmail();
  await createExistingUser(page, email);

  // supabase/config.toml sets auth.email.max_frequency = "1s" -- GoTrue rejects a second
  // magic-link request to the same address within that window with a 429
  // (over_email_send_rate_limit). The two real requests this test makes (one to create the
  // fixture, one to actually sign in) can otherwise land well under a second apart.
  await page.waitForTimeout(1_100);

  await page.goto('/');
  await openSignInSheet(page);

  const sheet = page.locator('.sign-in-sheet');
  await sheet.getByLabel('Email').fill(email);
  await sheet.getByRole('button', { name: 'Sign in' }).click();

  await expect(sheet.getByRole('heading', { name: 'Check your email' })).toBeVisible();
});
