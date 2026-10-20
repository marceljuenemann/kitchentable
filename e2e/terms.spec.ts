import { expect, test } from '@playwright/test';
import { signInAs } from './support/admin';

test('a new user accepts the terms before onboarding', async ({ page }) => {
  await signInAs(page, null, { acceptedTerms: false });
  await expect(page.getByRole('heading', { name: 'Our commitments' })).toBeVisible();

  const terms = page.getByRole('checkbox', { name: /I agree to the Terms of Use/ });
  const consent = page.getByRole('checkbox', { name: /I consent to Kitchen Table/ });
  const continueButton = page.getByRole('button', { name: 'Continue' });

  // The link in the checkbox's label opens the document in a sheet, without ticking the box.
  await page
    .locator('mat-checkbox', { hasText: 'I agree to the Terms of Use' })
    .getByRole('link', { name: 'Terms of Use' })
    .click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('heading', { name: 'Kitchen Table Terms of Use' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(sheet).toBeHidden();
  await expect(terms).not.toBeChecked();

  await terms.check();
  await expect(continueButton).toBeDisabled();
  await consent.check();
  await continueButton.click();

  await expect(page.getByRole('heading', { name: 'Create profile' })).toBeVisible();

  // The acceptance is stored, so the screen doesn't come back.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Create profile' })).toBeVisible();
});
