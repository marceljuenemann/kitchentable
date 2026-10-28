import { expect, test } from '@playwright/test';
import { ProfileStatus, signInAs } from './support/admin';

const screens: [ProfileStatus | null, string][] = [
  [null, 'Create profile'],
  ['vetting', 'Thanks for applying'],
  ['approved', "You're approved!"],
  // The main app opens on the Search tab.
  ['active', 'Search'],
  ['disabled', 'Search'],
  ['suspended', 'Your profile is suspended'],
  ['deleted', 'Your profile has been deleted'],
  ['admin', 'Search'],
];

for (const [status, heading] of screens) {
  test(`shows the right screen for ${status ?? 'a user without a profile'}`, async ({ page }) => {
    await signInAs(page, status);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  });
}

test('an admin can open the admin tool', async ({ page }) => {
  await signInAs(page, 'admin');
  await page.goto('/admin/vetting');
  await expect(page.getByText(/applications? waiting/)).toBeVisible();
});

test('sends a signed-in user from the landing page to the app', async ({ page }) => {
  await signInAs(page, 'vetting');
  await page.goto('/');
  await page.waitForURL('**/app');
  await expect(page.getByRole('heading', { name: 'Thanks for applying' })).toBeVisible();
});

test('an applicant gets a personal invite link that opens the sign-up form', async ({
  page,
  browser,
}) => {
  await signInAs(page, 'vetting');

  await expect(page.getByRole('heading', { name: 'Help us launch' })).toBeVisible();
  const link = page.getByText(/\?invite=/);
  await expect(link).toHaveText(/^http:\/\/localhost:4200\/\?invite=[0-9a-f]{8}$/);

  // A friend, not signed in, opens it.
  const friend = await browser.newPage();
  await friend.goto((await link.textContent())!);
  await expect(friend.getByRole('heading', { name: 'Sign up' })).toBeVisible();
  await friend.close();
});

test('signing out returns to the landing page', async ({ page }) => {
  await signInAs(page, 'vetting');

  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL((url) => url.pathname === '/');
  await expect(
    page.getByRole('heading', { name: 'Kitchen Table is currently invite-only' }),
  ).toBeVisible();
});
