import { expect, test } from '@playwright/test';
import { ProfileStatus, signInAs } from './support/admin';

const screens: [ProfileStatus | null, string][] = [
  [null, 'Welcome'],
  ['vetting', 'Thanks for applying'],
  ['approved', "You're approved!"],
  ['active', 'Kitchen Table'],
  ['disabled', 'Kitchen Table'],
  ['suspended', 'Your profile is suspended'],
  ['deleted', 'Your profile has been deleted'],
];

for (const [status, heading] of screens) {
  test(`shows the right screen for ${status ?? 'a user without a profile'}`, async ({ page }) => {
    await signInAs(page, status);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  });
}

test('sends a signed-in user from the landing page to the app', async ({ page }) => {
  await signInAs(page, 'vetting');
  await page.goto('/');
  await page.waitForURL('**/app');
  await expect(page.getByRole('heading', { name: 'Thanks for applying' })).toBeVisible();
});

test('signing out clears the onboarding draft and returns to the landing page', async ({
  page,
}) => {
  await signInAs(page, null);
  await page.evaluate(() => localStorage.setItem('kt.onboardingDraft', '{"name":"Draft"}'));

  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL((url) => url.pathname === '/');

  expect(await page.evaluate(() => localStorage.getItem('kt.onboardingDraft'))).toBeNull();
  await expect(
    page.getByRole('heading', { name: 'Kitchen Table is currently invite-only' }),
  ).toBeVisible();
});
