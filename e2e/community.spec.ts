import { expect, test } from '@playwright/test';
import { createUser, setStatus, signIn, userIdOf } from './support/admin';

test('feedback and reports go to the conversation with the team', async ({ page }) => {
  // So there's a team to write to. Members are connected with the admins when they go live.
  await createUser('admin');
  const email = await createUser('approved');
  await setStatus(await userIdOf(email), 'active');
  await signIn(page, email);
  await page.goto('/app/community');

  // A change of mind sends the new mood too.
  await page.getByRole('button', { name: 'Okay' }).click();
  await page.getByRole('button', { name: 'Love it' }).click();
  await expect(page.getByRole('button', { name: 'Love it' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Okay' })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('textbox', { name: 'Tell us more' }).fill('The panda is adorable');
  await page.getByRole('button', { name: 'Send', exact: true }).click();

  await page.getByRole('link', { name: 'conversation with the team' }).click();
  const thread = page.locator('app-conversation');
  await expect(thread.getByText('Feedback: 😐 Okay')).toBeVisible();
  await expect(thread.getByText('Feedback: 😍 Love it')).toBeVisible();
  await expect(thread.getByText('Feedback submitted: The panda is adorable')).toBeVisible();

  await page.goBack();
  await page.getByRole('link', { name: 'Message the team' }).click();
  await expect(page.getByRole('textbox', { name: /^Message to/ })).toBeVisible();
});

test('an admin sees the community links, but no feedback or reports', async ({ page }) => {
  await createUser('admin').then((email) => signIn(page, email));
  await page.goto('/app/community');
  await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Join the WhatsApp group' })).toHaveAttribute(
    'href',
    /^https:\/\/chat\.whatsapp\.com\//,
  );
  await expect(page.getByRole('link', { name: 'Code on GitHub' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Report a problem' })).toHaveCount(0);
});
