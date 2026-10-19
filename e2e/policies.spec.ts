import { expect, test } from '@playwright/test';

test('footer links open the Terms of Use and the Privacy Policy', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('link', { name: 'Terms of Use' }).click();
  await page.waitForURL('**/about/terms');
  await expect(page.getByRole('heading', { name: 'Kitchen Table Terms of Use' })).toBeVisible();

  await page.getByRole('link', { name: 'Privacy Policy' }).click();
  await page.waitForURL('**/about/privacy');
  await expect(page.getByRole('heading', { name: 'Kitchen Table Privacy Policy' })).toBeVisible();
  // Opened from the footer, so the new page must start at the top.
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});
