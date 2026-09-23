import { Page } from '@playwright/test';
import { uniqueEmail } from './test-email';

const API_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
// The Supabase CLI's well-known local service-role key: identical on every machine running
// `supabase start`, not a secret. Override for anything that isn't the local stack.
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

export type ProfileStatus =
  'vetting' | 'approved' | 'active' | 'disabled' | 'suspended' | 'deleted';

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

/**
 * Creates a user (consuming a seeded invite code, so the signup trigger still runs) without
 * going through the UI/email, optionally with a profile in the given status, and signs the
 * page in with a generated magic link. The status stands in for the admin/age-verification
 * steps that happen outside the app.
 */
export async function signInAs(page: Page, status: ProfileStatus | null): Promise<string> {
  const email = uniqueEmail('shell');
  const user = await api('/auth/v1/admin/users', {
    email,
    email_confirm: true,
    user_metadata: { invite_code: 'E2E-FRESH' },
  });

  if (status) {
    // Service role bypasses the client lockdown on `profiles` (no function creates these
    // rows yet).
    await api('/rest/v1/profiles', { id: user.id, status, name: 'E2E User' });
  }

  const link = await api('/auth/v1/admin/generate_link', {
    type: 'magiclink',
    email,
    redirect_to: 'http://localhost:4200/auth/callback',
  });
  await page.goto(link.action_link);
  await page.waitForURL('**/app');
  return email;
}
