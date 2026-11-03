import { expect, test } from '@playwright/test';
import { signInAs } from './support/admin';

test('the profile tab edits each field in a sheet, and Preview shows the changes', async ({
  page,
}) => {
  await signInAs(page, 'active');
  await page.goto('/app/profile');
  const sheet = page.locator('mat-bottom-sheet-container');

  await page.getByRole('button', { name: /^Name/ }).click();
  await sheet.getByRole('textbox', { name: 'Name' }).fill('Robin');
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole('button', { name: /^Name/ })).toContainText('Robin');

  // The tagline sheet shows the tile as it will look in search.
  await page.getByRole('button', { name: /^Tagline/ }).click();
  await sheet.getByRole('textbox', { name: 'Tagline' }).fill('Tea and long walks');
  await expect(sheet.locator('app-profile-tile')).toContainText('Robin');
  await expect(sheet.locator('app-profile-tile')).toContainText('Tea and long walks');
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toBeHidden();

  // Looking for needs at least one.
  await page.getByRole('button', { name: /^Looking for/ }).click();
  await expect(sheet.getByRole('button', { name: 'Pick at least one' })).toBeDisabled();
  await sheet.getByRole('option', { name: 'Friends' }).click();
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole('button', { name: /^Looking for/ })).toContainText('Friends');

  await page.getByRole('link', { name: 'Preview' }).click();
  await expect(page).toHaveURL('/app/profile/preview');
  const preview = page.locator('app-profile-view');
  await expect(preview.getByRole('heading', { name: 'Robin' })).toBeVisible();
  await expect(preview.getByText('Friends')).toBeVisible();

  await preview.getByRole('button', { name: 'Back to your profile' }).click();
  await expect(page).toHaveURL('/app/profile');

  await page.getByRole('link', { name: 'Preview' }).click();
  await page.locator('app-profile-view').getByRole('button', { name: 'Close preview' }).click();
  await expect(page).toHaveURL('/app/profile');
});
