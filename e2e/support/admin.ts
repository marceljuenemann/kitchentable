import { Page } from '@playwright/test';
import { uniqueEmail } from './test-email';

const API_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
// The Supabase CLI's well-known local service-role key: identical on every machine running
// `supabase start`, not a secret. Override for anything that isn't the local stack.
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

export type ProfileStatus =
  'vetting' | 'approved' | 'active' | 'disabled' | 'suspended' | 'deleted' | 'admin';

async function api(path: string, body: unknown, method = 'POST') {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${method} ${path} failed: ${await response.text()}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

/** Asks GoTrue to email a sign-in link to an existing user, without going through the UI. */
export async function sendSignInEmail(email: string) {
  await api('/auth/v1/otp', { email, create_user: false });
}

/** The profile rows with the given name, read with the service role. */
export async function profilesNamed(name: string): Promise<Record<string, unknown>[]> {
  const response = await fetch(
    `${API_URL}/rest/v1/profiles?select=*&name=eq.${encodeURIComponent(name)}`,
    { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } },
  );
  if (!response.ok) throw new Error(`Reading profiles failed: ${await response.text()}`);
  return response.json();
}

/** A file in the private `photos` bucket, read (or deleted) with the service role. */
export async function photoObject(
  path: string,
  method: 'GET' | 'DELETE' = 'GET',
): Promise<{ ok: boolean; bytes: Buffer }> {
  const response = await fetch(`${API_URL}/storage/v1/object/photos/${path}`, {
    method,
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  return { ok: response.ok, bytes: Buffer.from(await response.arrayBuffer()) };
}

/**
 * Creates a user (with an invite code in the sign-up metadata, as the landing page sends it)
 * without going through the UI/email, optionally with a profile in the given status, and signs
 * the page in with a generated magic link. The status stands in for the admin/age-verification
 * steps that happen outside the app. The user has accepted the terms unless `acceptedTerms` is
 * false (a profile needs them).
 */
export async function signInAs(
  page: Page,
  status: ProfileStatus | null,
  options: { acceptedTerms?: boolean } = {},
): Promise<string> {
  const email = await createUser(status, options);
  await signIn(page, email);
  return email;
}

/**
 * Creates a user like `signInAs` without signing in. GoTrue allows one sign-in link per user
 * a second (`max_frequency`), so use this before asking for a sign-in email.
 */
export async function createUser(
  status: ProfileStatus | null,
  { acceptedTerms = true } = {},
): Promise<string> {
  const email = uniqueEmail('shell');
  const user = await api('/auth/v1/admin/users', {
    email,
    email_confirm: true,
    user_metadata: { invite_code: 'E2E-INVITE' },
  });

  if (acceptedTerms) {
    await api('/rest/v1/terms_acceptances', { user_id: user.id, version: 1 });
  }

  if (status) {
    // Service role bypasses the client lockdown on `profiles` (only `submit_onboarding` creates
    // these rows for real users, and it needs photos etc.).
    await api('/rest/v1/profiles', {
      id: user.id,
      status,
      name: 'E2E User',
      pronouns: 'they/them',
      bio: 'About the E2E user',
      location: 'London',
    });
  }

  return email;
}

/** Signs the page in as an existing user via a generated magic link (no email involved). */
export async function signIn(page: Page, email: string) {
  const link = await api('/auth/v1/admin/generate_link', {
    type: 'magiclink',
    email,
    redirect_to: 'http://localhost:4200/auth/callback',
  });
  await page.goto(link.action_link);
  await page.waitForURL('**/app');
}
