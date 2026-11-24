import { expect, test } from '@playwright/test';
import { ProfileStatus, signInAs } from './support/admin';

const screens: [ProfileStatus | null, string, boolean?][] = [
  [null, 'Join in 4 simple steps'],
  // Applicants check their age right after submitting.
  ['vetting', 'Selfie age check'],
  ['vetting', 'Thanks for signing up', true],
  ['approved', 'Selfie age check'],
  // The main app opens on the Search tab.
  ['active', 'Search'],
  ['disabled', 'Your profile is hidden'],
  ['suspended', 'Your profile is suspended'],
  ['deleted', 'Your profile has been deleted'],
  ['admin', 'Search'],
];

for (const [status, heading, ageVerified] of screens) {
  const who = `${status ?? 'a user without a profile'}${ageVerified ? ' (age checked)' : ''}`;
  test(`shows the right screen for ${who}`, async ({ page }) => {
    await signInAs(page, status, { ageVerified });
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  });
}

test('an admin can open the admin tool', async ({ page }) => {
  await signInAs(page, 'admin');
  await page.goto('/admin/vetting');
  await expect(page.getByText(/applications? waiting/)).toBeVisible();
});

test('welcomes a signed-in user back on the landing page, with a way into the app', async ({
  page,
}) => {
  const email = await signInAs(page, 'vetting', { ageVerified: true });
  await page.goto('/?invite=anything');
  const card = page.locator('.signup-card');
  await expect(card.getByRole('heading', { name: 'Welcome back!' })).toBeVisible();
  await expect(card.getByText(`You're signed in as ${email}.`)).toBeVisible();
  await expect(page.getByLabel('Email')).toHaveCount(0);

  await card.getByRole('link', { name: 'Open the app' }).click();
  await page.waitForURL('**/app');
  await expect(page.getByRole('heading', { name: 'Thanks for signing up' })).toBeVisible();
});

test('an applicant gets a personal invite link that opens the sign-up form', async ({
  page,
  browser,
}) => {
  await signInAs(page, 'vetting', { ageVerified: true });

  await expect(page.getByRole('heading', { name: 'Help us grow' })).toBeVisible();
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
