import { expect, Page } from '@playwright/test';
import { signInAs } from './admin';

/** Gets a fresh user through steps 1 and 2 of onboarding, ending on the photos step. */
export async function goToPhotosStep(page: Page) {
  await signInAs(page, null);
  await page.getByLabel('Name').fill('Sam');
  await page.getByRole('button', { name: /Preferred pronouns/ }).click();
  await page.getByRole('option', { name: 'they/them' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByLabel('About you').fill('x'.repeat(250));
  await page.getByRole('option', { name: 'Polyamory' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add photos' })).toBeVisible();
}

/** The crop bottom sheet. */
export const dialog = (page: Page) => page.getByRole('dialog');

/**
 * Picks a generated JPEG of the given size in the (hidden) file input, so tests can tell which
 * part of the photo ended up in a crop: the left half red and the right half blue, or with
 * `thirds` red, blue, red.
 */
export async function choosePhoto(page: Page, width: number, height: number, thirds = false) {
  await page.evaluate(
    async ({ width, height, thirds }) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#ff0000';
      context.fillRect(0, 0, width, height);
      context.fillStyle = '#0000ff';
      if (thirds) {
        context.fillRect(width / 3, 0, width / 3, height);
      } else {
        context.fillRect(width / 2, 0, width / 2, height);
      }
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.9),
      );
      const transfer = new DataTransfer();
      transfer.items.add(new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
      const input = document.querySelector<HTMLInputElement>('input[type=file]')!;
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    },
    { width, height, thirds },
  );
}
