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

test('the draft survives a reload and an expired session, and is cleared on sign-out', async ({
  page,
}) => {
  const email = await signInAs(page, null);
  await page.getByLabel('Name').fill('Sam');
  await page.getByRole('button', { name: /Preferred pronouns/ }).click();
  await page.getByRole('option', { name: 'they/them' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText("This step isn't built yet.")).toBeVisible();
  await expect.poll(() => draftKeys(page)).toHaveLength(1);

  await page.reload();
  await expect(page.getByText("This step isn't built yet.")).toBeVisible();

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
