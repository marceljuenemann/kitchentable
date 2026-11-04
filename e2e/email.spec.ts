import { expect, test } from '@playwright/test';
import {
  backdateSentTo,
  createIntro,
  createMember,
  createUser,
  sendEmailNotifications,
  sendSignInEmail,
} from './support/admin';
import { firstLink, getLatestEmail } from './support/mailpit';

// The template lives in supabase/templates/magic_link.html and is set up in supabase/config.toml.
// Changing either needs `supabase stop && supabase start` before this passes.
test('the sign-in email is branded, and its first link signs the user in', async ({ page }) => {
  const email = await createUser(null);
  await sendSignInEmail(email);

  const message = await getLatestEmail(email);

  expect(message.subject).toBe('Kitchen Table sign-in link');
  expect(message.html).toContain('Kitchen Table');
  expect(message.html).toContain('Your sign-in link');
  // The tests (and this check) rely on the button being the first link in the email.
  expect(firstLink(message.html)).toMatch(/\/auth\/v1\/verify\?.*type=magiclink/);
  // The logo is served by the app itself, from the site URL the email is built with.
  const logo = message.html.match(/<img[^>]*src="([^"]+)"/)?.[1];
  expect(logo).toBe('http://localhost:4200/email/logo-v1.png');
  const response = await fetch(logo!);
  expect(response.ok).toBe(true);
  expect(response.headers.get('content-type')).toContain('image/png');

  await page.goto(firstLink(message.html));
  await page.waitForURL('**/app');
  await expect(page.getByRole('heading', { name: 'Create profile' })).toBeVisible();
});

// The templates are in supabase/functions/send-email; see "Email notifications" in
// docs/database.md for when they're due.
test('the email notifications link to the intros and the messages, without personal data', async () => {
  const [amy, ben, cat, dan] = await Promise.all(
    ['Amy', 'Ben', 'Cat', 'Dan'].map((name) => createMember({ name })),
  );
  await createIntro(ben.id, amy.id, 'Hi Amy, fancy a walk?');
  await createIntro(cat.id, dan.id, 'Hi Dan, lovely to connect', 'accepted');
  // Emails wait until things have been unread for 15 minutes.
  await backdateSentTo(amy.id, 20);
  await backdateSentTo(dan.id, 20);
  const since = new Date();
  await sendEmailNotifications();

  const intro = await getLatestEmail(amy.email, 10_000, since);
  expect(intro.subject).toBe('Someone wants to connect with you');
  expect(firstLink(intro.html)).toBe('http://localhost:4200/app/connections');
  expect(intro.text).toContain('To unsubscribe');
  expect(intro.html).not.toContain('Ben');
  expect(intro.html).not.toContain('fancy a walk');

  const messages = await getLatestEmail(dan.email, 10_000, since);
  expect(messages.subject).toBe('You have new messages');
  expect(firstLink(messages.html)).toBe('http://localhost:4200/app/messages');
  expect(messages.html).not.toContain('Cat');
  expect(messages.html).not.toContain('lovely to connect');
});
