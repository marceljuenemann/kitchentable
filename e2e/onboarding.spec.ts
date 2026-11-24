import { expect, Page, test } from '@playwright/test';
import { signIn, signInAs } from './support/admin';
import { startOnboarding } from './support/onboarding';

const draftKeys = (page: Page) =>
  page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('kt.user.')));

test('the overview explains the steps, and step 1 leads back to it', async ({ page }) => {
  await signInAs(page, null);

  await expect(page.getByRole('heading', { name: 'Join in 4 simple steps' })).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveText([
    /Add profile data/,
    /Write about yourself/,
    /Add photos/,
    /Selfie age check/,
  ]);
  await expect(page.getByText('Your progress is saved in this browser')).toBeVisible();
  // The progress bar has started, before step 1, and there's nothing to go back to.
  await expect(page.getByRole('progressbar', { name: 'Before step 1 of 4' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back' })).toBeHidden();

  await page.getByRole('button', { name: 'Get started' }).click();
  await expect(page.getByRole('heading', { name: 'Add profile data' })).toBeVisible();
  await expect(page.getByText('Step 1 of 4')).toBeVisible();

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'Join in 4 simple steps' })).toBeVisible();
});

test('step 1 only continues once name, pronouns and location are filled in', async ({ page }) => {
  await startOnboarding(page);
  const next = page.getByRole('button', { name: 'Continue' });
  await expect(next).toBeDisabled();

  await page.getByLabel('Name').fill('Sam');
  await expect(next).toBeDisabled();

  await page.getByRole('button', { name: /Pronouns/ }).click();
  await page.getByRole('option', { name: 'they/them' }).click();
  await expect(page.getByRole('button', { name: /Pronouns/ })).toContainText('they/them');
  await expect(next).toBeEnabled();

  // London is preselected; another city needs a name before the sheet can be saved.
  await expect(page.getByRole('button', { name: /^Location/ })).toContainText('London');
  await page.getByRole('button', { name: /^Location/ }).click();
  await page.getByRole('radio', { name: 'Somewhere else' }).check();
  await expect(page.getByText("We've only launched in London so far.")).toBeVisible();
  await expect(page.getByRole('button', { name: 'Done' })).toBeDisabled();
  await page.getByLabel('Where are you?').fill('Manchester');
  await page.getByRole('button', { name: 'Done' }).click();

  await expect(page.getByRole('button', { name: /^Location/ })).toContainText('Manchester');
  await expect(next).toBeEnabled();
});

test('age is worked out from the birth month and year in the age sheet', async ({ page }) => {
  await startOnboarding(page);
  // The age and the years on offer depend on today's date, so pin it: 15 June 2026.
  await page.clock.setFixedTime(new Date('2026-06-15T12:00:00'));

  const ageRow = page.getByRole('button', { name: /^Age/ });
  await expect(ageRow).toContainText('Add birthday');
  await ageRow.click();
  await expect(page.getByText('Pick a month and year.')).toBeVisible();

  // The newest year offered is someone who turns 19 this year (so nobody under 18 slips in),
  // and the list goes back 73 years from there.
  await page.getByRole('combobox', { name: 'Year' }).click();
  const years = page.getByRole('option');
  await expect(years.first()).toHaveText('2007');
  await expect(years.last()).toHaveText('1934');
  await years.first().click();
  // Wait for each dropdown to finish closing before opening the next: clicking while the old
  // panel is still animating away detaches the option we are about to click.
  await expect(page.getByRole('listbox')).toBeHidden();

  // Born in July 2007: the birthday hasn't happened yet this year.
  await page.getByRole('combobox', { name: 'Month' }).click();
  await page.getByRole('option', { name: 'July' }).click();
  await expect(page.getByRole('listbox')).toBeHidden();
  await expect(page.getByText('Age shown on profile: 18')).toBeVisible();

  // Born in June 2007: the birthday counts only once the birth month is over.
  await page.getByRole('combobox', { name: 'Month' }).click();
  await page.getByRole('option', { name: 'June' }).click();
  await expect(page.getByRole('listbox')).toBeHidden();
  await expect(page.getByText('Age shown on profile: 18')).toBeVisible();

  // Born in May 2007: already had it.
  await page.getByRole('combobox', { name: 'Month' }).click();
  await page.getByRole('option', { name: 'May' }).click();
  await expect(page.getByRole('listbox')).toBeHidden();
  await expect(page.getByText('Age shown on profile: 19')).toBeVisible();

  await page.getByRole('button', { name: 'Done' }).click();
  await expect(ageRow).toContainText('19');

  // Reopening shows what was picked.
  await ageRow.click();
  await expect(page.getByRole('combobox', { name: 'Month' })).toContainText('May');
  await expect(page.getByRole('combobox', { name: 'Year' })).toContainText('2007');

  // The birthday is optional, so it can be cleared again.
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(page.getByText('Pick a month and year.')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(ageRow).toContainText('Add birthday');
});

test('a custom value can be added in the option sheet', async ({ page }) => {
  await startOnboarding(page);
  await page.getByRole('button', { name: /^Gender/ }).click();
  await page.getByRole('option', { name: 'Woman', exact: true }).click();
  await page.getByLabel('Add your own').fill('bigender');
  await page.getByRole('button', { name: 'Add' }).click();
  await page.getByRole('button', { name: 'Done' }).click();

  await expect(page.getByRole('button', { name: /^Gender/ })).toContainText('Woman, bigender');
});

test('step 2 needs an about text of 250 characters and something you are looking for', async ({
  page,
}) => {
  await startOnboarding(page);
  await page.getByLabel('Name').fill('Sam');
  await page.getByRole('button', { name: /Pronouns/ }).click();
  await page.getByRole('option', { name: 'they/them' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  const next = page.getByRole('button', { name: 'Continue' });
  await expect(next).toBeDisabled();

  await expect(page.getByText('250 characters minimum')).toBeVisible();
  await page.getByLabel('About you').fill('x'.repeat(249));
  await expect(page.getByText('249 / 250')).toBeVisible();
  await page.getByLabel('About you').fill('x'.repeat(250));
  await expect(page.getByText('250 characters')).toBeVisible();
  await expect(next).toBeDisabled();

  await page.getByRole('option', { name: 'Polyamory' }).click();
  await expect(next).toBeEnabled();

  // Own entries appear as extra, selected chips.
  await page.getByLabel('Add your own').fill('Polycule friends');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('option', { name: 'Polycule friends' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  await next.click();
  await expect(page.getByRole('heading', { name: 'Add photos' })).toBeVisible();
});

test('a draft saved on the vetting questions, which are gone, opens on the photos step', async ({
  page,
}) => {
  await startOnboarding(page);
  // A draft from before the vetting step (step 4) was removed.
  await page.getByLabel('Name').fill('Sam');
  await expect.poll(() => draftKeys(page)).toHaveLength(1);
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('kt.user.'))!;
    const draft = JSON.parse(localStorage.getItem(key)!);
    localStorage.setItem(
      key,
      JSON.stringify({ ...draft, step: 4, vettingAnswers: { consent: 'x'.repeat(80) } }),
    );
  });
  await page.reload();

  await expect(page.getByRole('heading', { name: 'Add photos' })).toBeVisible();
  await expect(page.getByText('Step 3 of 4')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create profile' })).toBeDisabled();
});

test('the draft survives a reload and an expired session, and is cleared on sign-out', async ({
  page,
}) => {
  const email = await startOnboarding(page);
  await page.getByLabel('Name').fill('Sam');
  await page.getByRole('button', { name: /Pronouns/ }).click();
  await page.getByRole('option', { name: 'they/them' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Write about yourself' })).toBeVisible();
  await expect.poll(() => draftKeys(page)).toHaveLength(1);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Write about yourself' })).toBeVisible();

  // Simulate the session expiring: the auth token goes, the draft must stay.
  await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((key) => key.startsWith('sb-'))
      .forEach((key) => localStorage.removeItem(key)),
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /invite-only/ })).toBeVisible();
  expect(await draftKeys(page)).toHaveLength(1);

  await signIn(page, email);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByLabel('Name')).toHaveValue('Sam');

  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL((url) => url.pathname === '/');
  expect(await draftKeys(page)).toHaveLength(0);
});
