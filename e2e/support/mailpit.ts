const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';

interface MailpitMessageSummary {
  ID: string;
  To: { Address: string }[];
}

interface MailpitMessage {
  HTML: string;
}

/**
 * Polls Mailpit (Supabase's local dev SMTP capture, see README.md) for the most recent
 * message sent to `email` and extracts the magic-link URL from its HTML body.
 */
export async function getLatestMagicLink(email: string, timeoutMs = 10_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const list = (await (await fetch(`${MAILPIT_URL}/api/v1/messages`)).json()) as {
      messages: MailpitMessageSummary[];
    };
    const match = list.messages.find((m) => m.To?.some((to) => to.Address === email));
    if (match) {
      const full = (await (
        await fetch(`${MAILPIT_URL}/api/v1/message/${match.ID}`)
      ).json()) as MailpitMessage;
      const hrefMatch = full.HTML.match(/href="([^"]+)"/);
      if (hrefMatch) return hrefMatch[1].replace(/&amp;/g, '&');
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No email with a magic link arrived for ${email} within ${timeoutMs}ms`);
}
