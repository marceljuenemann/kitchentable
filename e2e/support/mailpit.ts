const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';

interface MailpitMessageSummary {
  ID: string;
  Subject: string;
  To: { Address: string }[];
  Created: string;
}

interface MailpitMessage {
  HTML: string;
  Text: string;
}

export interface Email {
  subject: string;
  html: string;
  text: string;
}

/**
 * Polls Mailpit (Supabase's local dev SMTP capture, see README.md) for the most recent
 * message sent to `email`, optionally only one that arrived after `since`.
 */
export async function getLatestEmail(
  email: string,
  timeoutMs = 10_000,
  since?: Date,
): Promise<Email> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const list = (await (await fetch(`${MAILPIT_URL}/api/v1/messages`)).json()) as {
      messages: MailpitMessageSummary[];
    };
    const match = list.messages.find(
      (m) => m.To?.some((to) => to.Address === email) && (!since || new Date(m.Created) >= since),
    );
    if (match) {
      const full = (await (
        await fetch(`${MAILPIT_URL}/api/v1/message/${match.ID}`)
      ).json()) as MailpitMessage;
      return { subject: match.Subject, html: full.HTML, text: full.Text };
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No email arrived for ${email} within ${timeoutMs}ms`);
}

/** The first link in an email (the sign-in link; the template keeps the button first). */
export function firstLink(html: string): string {
  const hrefMatch = html.match(/href="([^"]+)"/);
  if (!hrefMatch) throw new Error('The email has no link');
  return hrefMatch[1].replace(/&amp;/g, '&');
}

/** Extracts the magic-link URL from the most recent message sent to `email`. */
export async function getLatestMagicLink(email: string, timeoutMs = 10_000): Promise<string> {
  return firstLink((await getLatestEmail(email, timeoutMs)).html);
}
