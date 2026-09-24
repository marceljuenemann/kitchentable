import { expect, Page, test } from '@playwright/test';
import { signIn, signInAs } from './support/admin';

const draftKeys = (page: Page) =>
  page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('kt.user.')));

test('step 1 only continues once name, pronouns and location are filled in', async ({ page }) => {
  await signInAs(page, null);
  const next = page.getByRole('button', { name: 'Continue' });
  await expect(next).toBeDisabled();

  await page.getByLabel('Name').fill('Sam');
  await expect(next).toBeDisabled();

  await page.getByRole('button', { name: /Preferred pronouns/ }).click();
  await page.getByRole('option', { name: 'they/them' }).click();
  await expect(page.getByRole('button', { name: /Preferred pronouns/ })).toContainText('they/them');
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

test('a custom value can be added in the option sheet', async ({ page }) => {
  await signInAs(page, null);
  await page.getByRole('button', { name: /^Gender/ }).click();
  await page.getByRole('option', { name: 'Woman', exact: true }).click();
  await page.getByLabel('Self describe').fill('bigender');
  await page.getByRole('button', { name: 'Add' }).click();
  await page.getByRole('button', { name: 'Done' }).click();

  await expect(page.getByRole('button', { name: /^Gender/ })).toContainText('Woman, bigender');
});

test('step 2 needs an about text of 250 characters and something you are looking for', async ({
  page,
}) => {
  await signInAs(page, null);
  await page.getByLabel('Name').fill('Sam');
  await page.getByRole('button', { name: /Preferred pronouns/ }).click();
  await page.getByRole('option', { name: 'they/them' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  const next = page.getByRole('button', { name: 'Continue' });
  await expect(next).toBeDisabled();

  await page.getByLabel('About you').fill('x'.repeat(249));
  await expect(page.getByText('1 characters to go')).toBeVisible();
  await page.getByLabel('About you').fill('x'.repeat(250));
  await expect(page.getByText('250 characters')).toBeVisible();
  await expect(next).toBeDisabled();

  await page.getByRole('option', { name: 'Solo poly' }).click();
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

test('the draft survives a reload and an expired session, and is cleared on sign-out', async ({
  page,
}) => {
  const email = await signInAs(page, null);
  await page.getByLabel('Name').fill('Sam');
  await page.getByRole('button', { name: /Preferred pronouns/ }).click();
  await page.getByRole('option', { name: 'they/them' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'About you' })).toBeVisible();
  await expect.poll(() => draftKeys(page)).toHaveLength(1);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'About you' })).toBeVisible();

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
