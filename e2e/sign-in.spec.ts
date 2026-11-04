import { expect, Page, test } from '@playwright/test';
import { getLatestMagicLink } from './support/mailpit';
import { uniqueEmail } from './support/test-email';

/** Creates a real, GoTrue-native user via the landing page's own sign-up flow, without
 *  clicking the magic link -- just enough to exist for a later sign-in test. */
async function createExistingUser(page: Page, email: string) {
  await page.goto('/?invite=E2E-INVITE');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
}

test('the landing page links to the sign-in page', async ({ page }) => {
  await page.goto('/');
  await page.locator('.signin-line').getByRole('link', { name: 'Sign in' }).click();
  await page.waitForURL((url) => url.pathname === '/sign-in');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeFocused();
});

// The page must not reveal whether an address is registered, so an unknown one gets the same
// answer as a known one, and a working link (which leads to the terms, then onboarding).
test('an email with no existing account gets a sign-in link too', async ({ page }) => {
  const email = uniqueEmail();
  await page.goto('/sign-in');

  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

  await page.goto(await getLatestMagicLink(email));
  await page.waitForURL('**/app');
  await expect(page.getByRole('heading', { name: 'Our commitments' })).toBeVisible();
});

test('the Privacy Policy opens in a sheet, keeping the email typed', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill('sam@example.com');

  await page.getByRole('link', { name: 'Privacy Policy' }).first().click();
  const policySheet = page.locator('app-policy-sheet');
  await expect(
    policySheet.getByRole('heading', { name: 'Kitchen Table Privacy Policy' }),
  ).toBeVisible();
  await policySheet.getByRole('button', { name: 'Close' }).click();

  await expect(policySheet).toBeHidden();
  await expect(page.getByLabel('Email')).toHaveValue('sam@example.com');
});

test('pressing Enter in the email field signs in', async ({ page }) => {
  // The failing request shows that the form was submitted, without sending an email.
  await page.route('**/auth/v1/otp*', (route) => route.abort());
  await page.goto('/sign-in');

  await page.getByLabel('Email').fill(uniqueEmail());
  await page.getByLabel('Email').press('Enter');

  await expect(page.getByText('Something went wrong. Please try again in a minute.')).toBeVisible();
});

test('shows a generic error when the request fails', async ({ page }) => {
  await page.route('**/auth/v1/otp*', (route) => route.abort());
  await page.goto('/sign-in');

  await page.getByLabel('Email').fill(uniqueEmail());
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText('Something went wrong. Please try again in a minute.')).toBeVisible();
});

test('an existing user can request a sign-in link', async ({ page }) => {
  const email = uniqueEmail();
  await createExistingUser(page, email);

  // supabase/config.toml sets auth.email.max_frequency = "1s" -- GoTrue rejects a second
  // magic-link request to the same address within that window with a 429
  // (over_email_send_rate_limit). The two real requests this test makes (one to create the
  // fixture, one to actually sign in) can otherwise land well under a second apart.
  await page.waitForTimeout(1_100);

  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
});
