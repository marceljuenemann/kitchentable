// Emails the admin that a new application is waiting for review. Called by the
// notify_admin_of_application trigger on profiles (see docs/database.md), never by clients, so
// it checks a shared secret instead of a user's JWT (verify_jwt = false in config.toml).
//
// The email holds no personal data, only a link to the admin screen.
//
// Environment (supabase/functions/.env locally, `supabase secrets set` on staging, see README):
// - NOTIFY_ADMIN_SECRET: the same value as the `notify_admin_secret` vault secret
// - ADMIN_EMAIL: who to notify
// - SITE_URL: the frontend, for the link
// - MAILTRAP_TOKEN: a Mailtrap API token with sending access, or locally
//   MAILPIT_URL: Supabase's local Mailpit, which captures the email instead
import { timingSafeEqual } from 'jsr:@std/crypto@1/timing-safe-equal';

const FROM = { email: 'no-reply@kitchentable.dating', name: 'Kitchen Table' };

interface Email {
  to: string;
  subject: string;
  text: string;
}

Deno.serve(async (req) => {
  try {
    if (!isAuthorized(req)) return new Response('Unauthorized', { status: 401 });

    await send({
      to: env('ADMIN_EMAIL'),
      subject: 'New application to review',
      text: `Someone has applied to join Kitchen Table. Review it at ${env('SITE_URL')}/admin/vetting\n`,
    });
    return new Response('Sent');
  } catch (error) {
    console.error('Could not notify the admin', error);
    return new Response('Failed', { status: 500 });
  }
});

function isAuthorized(req: Request): boolean {
  const encoder = new TextEncoder();
  const given = encoder.encode(req.headers.get('x-notify-admin-secret') ?? '');
  const expected = encoder.encode(env('NOTIFY_ADMIN_SECRET'));
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function send(email: Email): Promise<void> {
  const mailpitUrl = Deno.env.get('MAILPIT_URL');
  const response = mailpitUrl
    ? await fetch(`${mailpitUrl}/api/v1/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          From: { Email: FROM.email, Name: FROM.name },
          To: [{ Email: email.to }],
          Subject: email.subject,
          Text: email.text,
        }),
      })
    : await fetch('https://send.api.mailtrap.io/api/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env('MAILTRAP_TOKEN')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM,
          to: [{ email: email.to }],
          subject: email.subject,
          text: email.text,
          category: 'admin',
        }),
      });
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
}
