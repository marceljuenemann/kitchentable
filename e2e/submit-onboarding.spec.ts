import { expect, Page, test } from '@playwright/test';
import { profilesNamed } from './support/admin';
import { choosePhoto, dialog, goToPhotosStep } from './support/onboarding';

const draftKeys = (page: Page) =>
  page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('kt.user.')));

/** Fills in steps 1 to 3 (with a unique name) and answers the vetting questions on step 4. */
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
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByLabel(/^In your own words/).fill('a'.repeat(80));
  await page.getByLabel(/^What guidelines/).fill('b'.repeat(80));
}

test('submitting the application creates the profile and moves on to "being vetted"', async ({
  page,
}) => {
  const name = `Sam ${Date.now()}`;
  await fillInEverything(page, name);

  await page.getByRole('button', { name: 'Submit application' }).click();

  // The shell reloads the profile and shows the screen for the new `vetting` status.
  await expect(page.getByText('Thanks for applying')).toBeVisible();

  const [profile] = await profilesNamed(name);
  expect(profile).toMatchObject({
    status: 'vetting',
    pronouns: 'they/them',
    tagline: '',
    location: 'London',
    bio: 'x'.repeat(250),
    looking_for: ['solo-poly'],
    gender: [],
    birth_year: null,
    vetting_answers: {
      consent: 'a'.repeat(80),
      guidelines: 'b'.repeat(80),
      invite_code: 'E2E-INVITE', // from the sign-up metadata, see signInAs
    },
  });
  expect(profile['photos']).toHaveLength(1);

  // A reload stays on the same screen rather than back in onboarding.
  await page.reload();
  await expect(page.getByText('Thanks for applying')).toBeVisible();
});

test('a failed submission shows an error, keeps the draft, and can be retried', async ({
  page,
}) => {
  const name = `Sam ${Date.now()}`;
  await fillInEverything(page, name);

  await page.route('**/rest/v1/rpc/submit_onboarding', (route) => route.abort());
  await page.getByRole('button', { name: 'Submit application' }).click();
  await expect(page.getByRole('alert')).toContainText("We couldn't submit your application");
  await expect(page.getByRole('button', { name: 'Submit application' })).toBeEnabled();
  expect(await profilesNamed(name)).toHaveLength(0);
  expect(await draftKeys(page)).toHaveLength(1);

  await page.unroute('**/rest/v1/rpc/submit_onboarding');
  await page.getByRole('button', { name: 'Submit application' }).click();
  await expect(page.getByText('Thanks for applying')).toBeVisible();
  expect(await profilesNamed(name)).toHaveLength(1);
});
