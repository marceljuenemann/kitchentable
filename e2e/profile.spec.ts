import { randomUUID } from 'node:crypto';
import { expect, Page, test } from '@playwright/test';
import { createMember, jpeg, photoObject, profileOf, signIn, uploadPhoto } from './support/admin';

/**
 * Signs in as a live member with photos (a profile needs one to be saved), in a location of
 * their own so they stay out of other tests' search.
 */
async function signInWithPhotos(page: Page, count = 2) {
  await page.goto('/');
  const photos = Array.from({ length: count }, () => randomUUID());
  const { id, email } = await createMember({
    name: 'Sam',
    location: `Profileville ${randomUUID()}`,
    looking_for: ['polyamory'],
    photos,
  });
  const image = await jpeg(page, '#6cc3a0');
  for (const photo of photos) {
    await uploadPhoto(`${id}/${photo}/full.jpg`, image);
    await uploadPhoto(`${id}/${photo}/thumb.jpg`, image);
  }
  await signIn(page, email);
  await page.goto('/app/profile');
  return { id, photos };
}

const row = (page: Page, label: string) =>
  page.getByRole('button', { name: new RegExp(`^${label}`) });

test('each field is edited in a sheet and saved, and Preview shows the changes', async ({
  page,
}) => {
  const { id } = await signInWithPhotos(page);
  const sheet = page.locator('mat-bottom-sheet-container');

  await row(page, 'Name').click();
  await sheet.getByRole('textbox', { name: 'Name' }).fill('Robin');
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toBeHidden();
  await expect(row(page, 'Name')).toContainText('Robin');

  // The tagline sheet shows the tile as it will look in search.
  await row(page, 'Tagline').click();
  await sheet.getByRole('textbox', { name: 'Tagline' }).fill('Tea and long walks');
  await expect(sheet.locator('app-profile-tile')).toContainText('Robin');
  await expect(sheet.locator('app-profile-tile')).toContainText('Tea and long walks');
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toBeHidden();

  // Looking for needs at least one.
  await row(page, 'Looking for').click();
  await sheet.getByRole('button', { name: 'Clear' }).click();
  await expect(sheet.getByRole('button', { name: 'Pick at least one' })).toBeDisabled();
  await sheet.getByRole('option', { name: 'Friends' }).click();
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toBeHidden();
  await expect(row(page, 'Looking for')).toContainText('Friends');

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

  // Saved: still there after a reload.
  await expect.poll(async () => (await profileOf(id)).looking_for).toEqual(['friends']);
  await page.reload();
  await expect(row(page, 'Name')).toContainText('Robin');
  await expect(row(page, 'Tagline')).toContainText('Tea and long walks');
  await expect(row(page, 'Looking for')).toContainText('Friends');
});

test('a removed photo comes off the profile, then its files are deleted', async ({ page }) => {
  const { id, photos } = await signInWithPhotos(page);
  await expect(page.getByRole('img', { name: 'Photo 2' })).toBeVisible();

  await page.getByRole('button', { name: 'Remove photo 2' }).click();

  await expect.poll(async () => (await profileOf(id)).photos).toEqual([photos[0]]);
  await expect.poll(async () => (await photoObject(`${id}/${photos[1]}/thumb.jpg`)).ok).toBe(false);
  await expect.poll(async () => (await photoObject(`${id}/${photos[1]}/full.jpg`)).ok).toBe(false);
  expect((await photoObject(`${id}/${photos[0]}/thumb.jpg`)).ok).toBe(true);
  // A profile needs a photo, so the last one can't be removed.
  await expect(page.getByRole('button', { name: 'Remove photo 1' })).toBeHidden();
});

test('a failed save puts the profile back, and Retry saves it', async ({ page }) => {
  const { id } = await signInWithPhotos(page);
  const sheet = page.locator('mat-bottom-sheet-container');
  await page.route('**/rest/v1/rpc/update_profile', (route) => route.abort());

  await row(page, 'Name').click();
  await sheet.getByRole('textbox', { name: 'Name' }).fill('Robin');
  await sheet.getByRole('button', { name: 'Done' }).click();

  await expect(page.getByText("Couldn't save your profile")).toBeVisible();
  await expect(row(page, 'Name')).toContainText('Sam');

  await page.unroute('**/rest/v1/rpc/update_profile');
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(row(page, 'Name')).toContainText('Robin');
  await expect.poll(async () => (await profileOf(id)).name).toBe('Robin');
});

test('each kind of email is switched off in the Settings sheet', async ({ page }) => {
  const { id } = await signInWithPhotos(page, 1);
  const sheet = page.locator('mat-bottom-sheet-container');
  const intros = sheet.getByRole('switch', { name: 'Email me about new intros' });
  const messages = sheet.getByRole('switch', { name: 'Email me about new messages' });

  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(intros).toHaveAttribute('aria-checked', 'true');
  await expect(messages).toHaveAttribute('aria-checked', 'true');
  await messages.click();
  await expect(messages).toHaveAttribute('aria-checked', 'false');
  await expect
    .poll(async () => {
      const { intro_emails, message_emails } = await profileOf(id);
      return { intro_emails, message_emails };
    })
    .toEqual({ intro_emails: true, message_emails: false });
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toBeHidden();

  await page.reload();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(intros).toHaveAttribute('aria-checked', 'true');
  await expect(messages).toHaveAttribute('aria-checked', 'false');
});
