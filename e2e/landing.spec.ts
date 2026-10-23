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
  await expect(page.getByRole('heading', { name: 'Sign up' })).toBeVisible();
});

test('pressing Enter in the email field signs up', async ({ page }) => {
  // The failing request shows that the form was submitted, without sending an email.
  await page.route('**/auth/v1/otp*', (route) => route.abort());
  await page.goto('/?invite=anything');
  await page.getByLabel('Email').fill(uniqueEmail());
  await page.getByLabel('Email').press('Enter');

  await expect(page.getByText('Something went wrong. Please try again in a minute.')).toBeVisible();
  await expect(page).toHaveURL(/\/\?invite=anything$/);
});

test('the sign-up form links to the Privacy Policy in a sheet', async ({ page }) => {
  await page.goto('/?invite=anything');
  await page.locator('.signup-card').getByRole('link', { name: 'Privacy Policy' }).click();

  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('heading', { name: 'Kitchen Table Privacy Policy' })).toBeVisible();
  await expect(page).toHaveURL(/\/\?invite=anything$/);
});

// Invite codes aren't validated at sign-up (they are checked by hand during vetting), so any
// code works.
test('completes the full sign-up flow with an invite code', async ({ page }) => {
  const email = uniqueEmail();

  await page.goto('/?invite=ANY-CODE');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Sign up' }).click();

  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

  const link = await getLatestMagicLink(email);
  await page.goto(link);
  await page.waitForURL('**/app');

  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
});
