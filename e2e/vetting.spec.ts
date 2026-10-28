import { randomUUID } from 'node:crypto';
import { expect, Page, test } from '@playwright/test';
import { createApplicant, profilesNamed, signInAs, uploadPhoto } from './support/admin';

/** A plain JPEG of the given colour, made in the browser. */
async function jpeg(page: Page, colour: string): Promise<Buffer> {
  const base64 = await page.evaluate(async (colour) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 600;
    const context = canvas.getContext('2d')!;
    context.fillStyle = colour;
    context.fillRect(0, 0, 600, 600);
    return canvas.toDataURL('image/jpeg').split(',')[1];
  }, colour);
  return Buffer.from(base64, 'base64');
}

/** An applicant with two photos, the answers to the vetting questions and an invite code. */
async function applicantWithPhotos(page: Page) {
  const name = `Ivy ${Date.now()}`;
  const photos = [randomUUID(), randomUUID()];
  const id = await createApplicant({
    name,
    tagline: 'Long tables and longer walks',
    bio: 'I host a monthly supper club.\n\nAnd I like long walks.',
    gender: ['Woman'],
    sexuality: ['Queer'],
    looking_for: ['polyamory'],
    photos,
    vetting_answers: {
      consent: 'Consent is an ongoing, enthusiastic yes.',
      guidelines: 'Be kind, be honest, respect boundaries.',
      invite_code: 'E2E-INVITE',
      onboarding_feedback: 'Smooth',
    },
  });
  for (const [index, photo] of photos.entries()) {
    const image = await jpeg(page, index === 0 ? '#c83897' : '#70c4ec');
    await uploadPhoto(`${id}/${photo}/thumb.jpg`, image);
    await uploadPhoto(`${id}/${photo}/full.jpg`, image);
  }
  return { id, name };
}

test('an admin reviews an application and approves it', async ({ page }) => {
  const applicant = await applicantWithPhotos(page);
  await signInAs(page, 'admin');
  await page.goto('/admin/vetting');

  // The grid: a tile with the main photo, name and tagline.
  const tile = page.getByRole('link', { name: new RegExp(applicant.name) });
  await expect(tile).toContainText('Long tables and longer walks');
  await expect(tile.locator('img')).toHaveJSProperty('complete', true);
  expect(await tile.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(600);

  // The profile, as members will see it, with the vetting box below it.
  await tile.click();
  await page.waitForURL(`**/admin/vetting/${applicant.id}`);
  await expect(page.getByRole('heading', { name: applicant.name, level: 1 })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Photo 1 of 2' })).toBeVisible();
  await expect(page.getByText('I host a monthly supper club.')).toBeVisible();
  await expect(page.getByText('Polyamory')).toBeVisible();
  const box = page.getByRole('region', { name: 'Vetting' });
  await expect(box).toContainText('Consent is an ongoing, enthusiastic yes.');
  await expect(box).toContainText('Be kind, be honest, respect boundaries.');
  await expect(box).toContainText('E2E-INVITE');
  await expect(box).toContainText('Long tables and longer walks');
  await expect(box).toContainText('Smooth');

  // Approving goes back to the grid, without the application.
  await box.getByRole('button', { name: `Approve ${applicant.name}` }).click();
  await page.waitForURL((url) => url.pathname === '/admin/vetting');
  await expect(tile).toBeHidden();
  expect((await profilesNamed(applicant.name))[0]['status']).toBe('approved');
});

test('the back button and the browser back both close a profile', async ({ page }) => {
  const applicant = await applicantWithPhotos(page);
  await signInAs(page, 'admin');
  await page.goto('/admin/vetting');
  const tile = page.getByRole('link', { name: new RegExp(applicant.name) });

  await tile.click();
  await page.waitForURL(`**/admin/vetting/${applicant.id}`);
  await page.getByRole('button', { name: 'Back to applications' }).click();
  await page.waitForURL((url) => url.pathname === '/admin/vetting');
  await expect(page.getByRole('heading', { name: applicant.name, level: 1 })).toBeHidden();

  await tile.click();
  await page.waitForURL(`**/admin/vetting/${applicant.id}`);
  await page.goBack();
  await page.waitForURL((url) => url.pathname === '/admin/vetting');
  await expect(tile).toBeVisible();
});

test('a profile can be opened by its URL, and shows when it is no longer waiting', async ({
  page,
}) => {
  const applicant = await applicantWithPhotos(page);
  await signInAs(page, 'admin');

  await page.goto(`/admin/vetting/${applicant.id}`);
  await expect(page.getByRole('heading', { name: applicant.name, level: 1 })).toBeVisible();
  // Opened directly, the back button goes to the grid.
  await page.getByRole('button', { name: 'Back to applications' }).click();
  await page.waitForURL((url) => url.pathname === '/admin/vetting');

  await page.goto(`/admin/vetting/${randomUUID()}`);
  await expect(page.getByText('This application is no longer waiting for review.')).toBeVisible();
});
