import { expect, Page, test } from '@playwright/test';
import { profilesNamed } from './support/admin';
import { getLatestEmail } from './support/mailpit';
import { choosePhoto, dialog, goToPhotosStep } from './support/onboarding';

/** ADMIN_EMAIL in supabase/functions/.env. */
const ADMIN_EMAIL = 'admin@kitchentable.dating';

const draftKeys = (page: Page) =>
  page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('kt.user.')));

/** Fills in steps 1 to 3 (with a unique name), ending on the photos step, ready to submit. */
async function fillInEverything(page: Page, name: string) {
  await goToPhotosStep(page);
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByLabel('Name').fill(name);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  await choosePhoto(page, 1200, 1200);
  await dialog(page).getByRole('button', { name: 'Use photo' }).click();
  await expect(dialog(page)).toBeHidden();
}

test('submitting the application creates the profile and moves on to the age check', async ({
  page,
}) => {
  const name = `Sam ${Date.now()}`;
  await fillInEverything(page, name);

  const submittedAt = new Date();
  await page.getByRole('button', { name: 'Create profile' }).click();

  // The shell reloads the profile, which is in `vetting` without an age check yet.
  await expect(page.getByRole('heading', { name: 'Selfie age check' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Verify my age' })).toBeVisible();

  // The admin gets an email with a link to review it, and no personal data.
  const email = await getLatestEmail(ADMIN_EMAIL, 10_000, submittedAt);
  expect(email.subject).toBe('New application to review');
  expect(email.text).toContain('http://localhost:4200/admin/vetting');
  expect(email.text).not.toContain(name);

  const [profile] = await profilesNamed(name);
  expect(profile).toMatchObject({
    status: 'vetting',
    pronouns: 'they/them',
    tagline: '',
    location: 'London',
    bio: 'x'.repeat(250),
    looking_for: ['polyamory'],
    gender: [],
    birth_year: null,
    // Only the invite code, from the sign-up metadata (see signInAs): onboarding no longer asks
    // the vetting questions.
    vetting_answers: { invite_code: 'E2E-INVITE' },
  });
  expect(profile['photos']).toHaveLength(1);

  // A reload stays on the same screen rather than back in onboarding.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Selfie age check' })).toBeVisible();
});

test('a failed submission shows an error, keeps the draft, and can be retried', async ({
  page,
}) => {
  const name = `Sam ${Date.now()}`;
  await fillInEverything(page, name);

  await page.route('**/rest/v1/rpc/submit_onboarding', (route) => route.abort());
  await page.getByRole('button', { name: 'Create profile' }).click();
  await expect(page.getByRole('alert')).toContainText("We couldn't create your profile");
  await expect(page.getByRole('button', { name: 'Create profile' })).toBeEnabled();
  expect(await profilesNamed(name)).toHaveLength(0);
  expect(await draftKeys(page)).toHaveLength(1);

  await page.unroute('**/rest/v1/rpc/submit_onboarding');
  await page.getByRole('button', { name: 'Create profile' }).click();
  await expect(page.getByRole('heading', { name: 'Selfie age check' })).toBeVisible();
  expect(await profilesNamed(name)).toHaveLength(1);
});
