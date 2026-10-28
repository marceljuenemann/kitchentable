// Sends one of the emails below, to the admin or to a member. Called by the database (the
// send_email() function, from triggers; see "Emails" in docs/database.md), never by clients, so
// it checks a shared secret instead of a user's JWT (verify_jwt = false in config.toml).
//
// The request names a template and, for member emails, the user's id: `{"template":
// "application_approved", "user_id": "…"}`. The address is looked up here, so it never sits in
// the database's request queue. No email holds personal data: no names, no message text.
//
// Environment (supabase/functions/.env locally, `supabase secrets set` on staging, see README):
// - SEND_EMAIL_SECRET: the same value as the `send_email_secret` vault secret
// - ADMIN_EMAIL: where admin emails go
// - SITE_URL: the frontend, for links and the logo
// - MAILTRAP_TOKEN: a Mailtrap API token with sending access, or locally
//   MAILPIT_URL: Supabase's local Mailpit, which captures the email instead
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set by Supabase.
import { timingSafeEqual } from 'jsr:@std/crypto@1/timing-safe-equal';
import { EmailContent, html, text } from './layout.ts';

const FROM = { email: 'no-reply@kitchentable.dating', name: 'Kitchen Table' };

interface Template {
  /** Who gets it: the admin, or the user the request names. */
  to: 'admin' | 'user';
  subject: string;
  /** Groups the emails in Mailtrap's statistics. */
  category: 'admin' | 'member';
  content: (siteUrl: string) => EmailContent;
}

const TEMPLATES: Record<string, Template> = {
  application_submitted: {
    to: 'admin',
    subject: 'New application to review',
    category: 'admin',
    content: (siteUrl) => ({
      preview: 'Someone has applied to join Kitchen Table.',
      heading: 'New application',
      paragraphs: ['Someone has applied to join Kitchen Table.'],
      button: { label: 'Review it', url: `${siteUrl}/admin/vetting` },
      footer: 'You get these emails as an admin of Kitchen Table.',
    }),
  },
  application_approved: {
    to: 'user',
    subject: "You're approved!",
    category: 'member',
    content: (siteUrl) => ({
      preview: 'Welcome! One quick step left and your profile goes live.',
      heading: "You're approved!",
      paragraphs: [
        "Welcome to Kitchen Table! We've approved your application.",
        "There's one quick step left before your profile goes live: a short age check, which " +
          "the UK's Online Safety Act requires.",
      ],
      // The age check is explained on the page, with the privacy details an email can't give.
      // A "verify" button in an email looks like phishing.
      button: { label: 'Open the app', url: `${siteUrl}/app` },
      footer: "You're getting this email because you applied to join Kitchen Table.",
    }),
  },
};

interface Email {
  to: string;
  subject: string;
  category: string;
  html: string;
  text: string;
}

Deno.serve(async (req) => {
  try {
    if (!isAuthorized(req)) return new Response('Unauthorized', { status: 401 });

    const { template: name, user_id: userId } = await req.json();
    const template = TEMPLATES[name];
    if (!template || (template.to === 'user' && !userId)) {
      return new Response('Unknown template, or no user', { status: 400 });
    }

    const siteUrl = env('SITE_URL');
    const content = template.content(siteUrl);
    await send({
      to: template.to === 'admin' ? env('ADMIN_EMAIL') : await emailOf(userId),
      subject: template.subject,
      category: template.category,
      html: html(content, siteUrl),
      text: text(content),
    });
    return new Response('Sent');
  } catch (error) {
    console.error('Could not send an email', error);
    return new Response('Failed', { status: 500 });
  }
});

function isAuthorized(req: Request): boolean {
  const encoder = new TextEncoder();
  const given = encoder.encode(req.headers.get('x-send-email-secret') ?? '');
  const expected = encoder.encode(env('SEND_EMAIL_SECRET'));
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** The user's email address, from Supabase Auth. */
async function emailOf(userId: string): Promise<string> {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetch(
    `${env('SUPABASE_URL')}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!response.ok) throw new Error(`Looking up the user: ${response.status}`);
  const { email } = await response.json();
  if (!email) throw new Error('The user has no email address');
  return email;
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
          HTML: email.html,
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
          html: email.html,
          text: email.text,
          category: email.category,
        }),
      });
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
}
