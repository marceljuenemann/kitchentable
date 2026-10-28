import { expect, test } from '@playwright/test';
import { createUser, profileOf, signInAs, userIdOf } from './support/admin';
import { sendDiditWebhook } from './support/didit';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };

test("starts the check on Didit's page", async ({ page }) => {
  await signInAs(page, 'approved');
  // There's no Didit API key locally, so stand in for the function and for Didit's page.
  await page.route('**/functions/v1/start-age-verification', (route) =>
    route.fulfill({ headers: CORS, json: { url: 'https://verify.didit.test/session' } }),
  );
  await page.route('https://verify.didit.test/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<h1>Didit</h1>' }),
  );

  await page.getByRole('button', { name: 'Verify my age' }).click();

  await expect(page).toHaveURL('https://verify.didit.test/session');
});

test('says so when the check cannot be started', async ({ page }) => {
  // The real function, which fails for want of a Didit API key.
  await signInAs(page, 'approved');

  await page.getByRole('button', { name: 'Verify my age' }).click();

  await expect(page.getByRole('alert')).toContainText("We couldn't start the check");
  await expect(page.getByRole('button', { name: 'Verify my age' })).toBeEnabled();
});

test('a passed check activates the profile and opens the app', async ({ page }) => {
  const email = await signInAs(page, 'approved');
  const id = await userIdOf(email);

  await page.goto('/app?verificationSessionId=e2e-session&status=Approved');
  await expect(page.getByRole('heading', { name: 'Finishing up' })).toBeVisible();
  await expect(page).toHaveURL(/\/app$/);

  expect((await sendDiditWebhook(id, 'Approved')).status).toBe(200);

  await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();
  const profile = await profileOf(id);
  expect(profile['status']).toBe('active');
  expect(profile['age_verified_at']).not.toBeNull();
});

test('a declined check can be tried again', async ({ page }) => {
  const email = await signInAs(page, 'approved');
  const id = await userIdOf(email);
  expect((await sendDiditWebhook(id, 'Declined')).status).toBe(200);

  await page.goto('/app?verificationSessionId=e2e-session&status=Declined');

  await expect(page.getByRole('heading', { name: "We couldn't confirm your age" })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  expect((await profileOf(id))['status']).toBe('approved');
});

test('the webhook activates only on a genuine, recent approval', async () => {
  const id = await userIdOf(await createUser('approved'));
  const statusAfter = async (response: Response) => {
    await response.body?.cancel();
    return (await profileOf(id))['status'];
  };

  const forged = await sendDiditWebhook(id, 'Approved', { secret: 'not-the-secret' });
  expect(forged.status).toBe(401);
  expect(await statusAfter(forged)).toBe('approved');

  const stale = await sendDiditWebhook(id, 'Approved', {
    timestamp: Math.floor(Date.now() / 1000) - 600,
  });
  expect(stale.status).toBe(401);
  expect(await statusAfter(stale)).toBe('approved');

  const otherWorkflow = await sendDiditWebhook(id, 'Approved', { workflowId: 'another-workflow' });
  expect(otherWorkflow.status).toBe(200);
  expect(await statusAfter(otherWorkflow)).toBe('approved');

  const genuine = await sendDiditWebhook(id, 'Approved');
  expect(await genuine.text()).toBe('Activated');
  expect((await profileOf(id))['status']).toBe('active');

  // Didit retries deliveries; a repeat changes nothing.
  expect(await (await sendDiditWebhook(id, 'Approved')).text()).toBe('Nothing to do');
});
