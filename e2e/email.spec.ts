import { expect, test } from '@playwright/test';
import { sendSignInEmail, signInAs } from './support/admin';
import { firstLink, getLatestEmail } from './support/mailpit';

// The template lives in supabase/templates/magic_link.html and is set up in supabase/config.toml.
// Changing either needs `supabase stop && supabase start` before this passes.
test('the sign-in email is branded, and its first link signs the user in', async ({ page }) => {
  const email = await signInAs(page, null);
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
});
