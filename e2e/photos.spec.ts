import { expect, Page, test } from '@playwright/test';
import { signInAs } from './support/admin';

/** Gets a fresh user through steps 1 and 2 of onboarding, ending on the photos step. */
async function goToPhotosStep(page: Page) {
  await signInAs(page, null);
  await page.getByLabel('Name').fill('Sam');
  await page.getByRole('button', { name: /Preferred pronouns/ }).click();
  await page.getByRole('option', { name: 'they/them' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByLabel('About you').fill('x'.repeat(250));
  await page.getByRole('option', { name: 'Solo poly' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add photos' })).toBeVisible();
}

/**
 * Picks a generated JPEG of the given size in the (hidden) file input, so tests can tell which
 * part of the photo ended up in a crop: the left half red and the right half blue, or with
 * `thirds` red, blue, red.
 */
async function choosePhoto(page: Page, width: number, height: number, thirds = false) {
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

const dialog = (page: Page) => page.getByRole('dialog'); // the crop bottom sheet

/** The crop frame's position once the sheet has finished sliding in (and is ready to use). */
async function settledFrame(page: Page) {
  await expect(dialog(page).getByRole('button', { name: 'Use photo' })).toBeEnabled();
  const frame = dialog(page).locator('.frame');
  let previous = await frame.boundingBox();
  for (let attempt = 0; attempt < 30; attempt++) {
    await page.waitForTimeout(100);
    const current = await frame.boundingBox();
    if (current && previous && current.x === previous.x && current.y === previous.y) return current;
    previous = current;
  }
  throw new Error('The crop sheet never settled');
}

/** Whether the pixel at (x, y) of the first tile's thumbnail is mostly red or mostly blue. */
async function tileColourAt(page: Page, x: number, y: number) {
  return page.getByRole('img', { name: 'Photo 1' }).evaluate(
    (img: HTMLImageElement, [x, y]) => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const context = canvas.getContext('2d')!;
      context.drawImage(img, 0, 0);
      const [red, , blue] = context.getImageData(x, y, 1, 1).data;
      return red > blue ? 'red' : 'blue';
    },
    [x, y],
  );
}

test('a photo is cropped into a square thumbnail tile', async ({ page }) => {
  await goToPhotosStep(page);
  const next = page.getByRole('button', { name: 'Continue' });
  await expect(next).toBeDisabled();
  await expect(page.getByText('Add at least one photo to continue.')).toBeVisible();

  await choosePhoto(page, 1600, 1200);
  await expect(dialog(page).getByRole('heading', { name: 'Crop photo' })).toBeVisible();
  await dialog(page).getByRole('button', { name: 'Use photo' }).click();
  await expect(dialog(page)).toBeHidden();

  const tile = page.getByRole('img', { name: 'Photo 1' });
  await expect(tile).toBeVisible();
  await expect(page.getByText('Main', { exact: true })).toBeVisible();
  await expect(next).toBeEnabled();

  // The tile shows the 600 px square thumbnail (docs/photos.md).
  const size = await tile.evaluate((img: HTMLImageElement) => [
    img.naturalWidth,
    img.naturalHeight,
  ]);
  expect(size).toEqual([600, 600]);

  await page.getByRole('button', { name: 'Remove photo 1' }).click();
  await expect(tile).toBeHidden();
  await expect(next).toBeDisabled();
});

test('the photo starts centred, and dragging it moves the crop', async ({ page }) => {
  await goToPhotosStep(page);

  // A 2:1 photo (left half red, right half blue): the centred square holds half of each.
  await choosePhoto(page, 1600, 800);
  await dialog(page).getByRole('button', { name: 'Use photo' }).click();
  await expect(page.getByRole('img', { name: 'Photo 1' })).toBeVisible();
  expect(await tileColourAt(page, 60, 300)).toBe('red');
  expect(await tileColourAt(page, 540, 300)).toBe('blue');
  await page.getByRole('button', { name: 'Remove photo 1' }).click();

  // Drag the photo far to the right: it stops at its left edge, so the crop is all red.
  await choosePhoto(page, 1600, 800);
  const frame = await settledFrame(page);
  const centre = { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.down();
  await page.mouse.move(centre.x + frame.width, centre.y, { steps: 10 });
  await page.mouse.up();
  await dialog(page).getByRole('button', { name: 'Use photo' }).click();
  await expect(page.getByRole('img', { name: 'Photo 1' })).toBeVisible();
  expect(await tileColourAt(page, 60, 300)).toBe('red');
  expect(await tileColourAt(page, 540, 300)).toBe('red');
});

test('zooming with the mouse wheel narrows the crop to the centre', async ({ page }) => {
  await goToPhotosStep(page);

  // Red, blue, red thirds: the default square shows a sliver of red at each side of the blue.
  await choosePhoto(page, 1600, 800, true);
  await dialog(page).getByRole('button', { name: 'Use photo' }).click();
  await expect(page.getByRole('img', { name: 'Photo 1' })).toBeVisible();
  expect(await tileColourAt(page, 60, 300)).toBe('red');
  expect(await tileColourAt(page, 300, 300)).toBe('blue');
  await page.getByRole('button', { name: 'Remove photo 1' }).click();

  // Zoomed all the way in on the centre, only the blue band is left.
  await choosePhoto(page, 1600, 800, true);
  const frame = await settledFrame(page);
  await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2);
  for (let i = 0; i < 25; i++) await page.mouse.wheel(0, -100);
  await dialog(page).getByRole('button', { name: 'Use photo' }).click();
  await expect(page.getByRole('img', { name: 'Photo 1' })).toBeVisible();
  expect(await tileColourAt(page, 60, 300)).toBe('blue');
  expect(await tileColourAt(page, 540, 300)).toBe('blue');
});

test('cancelling the crop adds nothing, and a too-small photo is rejected', async ({ page }) => {
  await goToPhotosStep(page);

  await choosePhoto(page, 1200, 1200);
  await dialog(page).getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(page.getByRole('img', { name: 'Photo 1' })).toBeHidden();

  await choosePhoto(page, 300, 300);
  await expect(page.getByRole('alert')).toContainText('too small');
  await expect(page.getByRole('img', { name: 'Photo 1' })).toBeHidden();
});

test('photos stay when moving between steps', async ({ page }) => {
  await goToPhotosStep(page);
  await choosePhoto(page, 1200, 1200);
  await dialog(page).getByRole('button', { name: 'Use photo' }).click();
  await expect(page.getByRole('img', { name: 'Photo 1' })).toBeVisible();

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText("This step isn't built yet.")).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('img', { name: 'Photo 1' })).toBeVisible();
});
