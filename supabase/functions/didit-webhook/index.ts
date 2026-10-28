// Didit calls this when an age check changes status (see "Age verification" in docs/database.md).
// When a check is approved, it activates the user's profile.
//
// Called by Didit, never by users, so it checks Didit's signature instead of a JWT
// (verify_jwt = false in config.toml). The webhook destination is set in the Didit console not to
// send ID details, and the payload is never logged or stored anyway: only the user id in
// `vendor_data`, which start-age-verification set, and the outcome are used.
//
// Environment (supabase/functions/.env locally, `supabase secrets set` on staging, see README):
// - DIDIT_WEBHOOK_SECRET: the secret of the webhook destination in the Didit console
// - DIDIT_WORKFLOW_ID: the age verification workflow
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set by Supabase.
import { timingSafeEqual } from 'jsr:@std/crypto@1/timing-safe-equal';

/** Didit's recommendation: older events may be replays. */
const MAX_AGE_SECONDS = 300;

interface DiditEvent {
  webhook_type: string;
  /** Unix seconds, refreshed on every delivery. */
  timestamp: number;
  status: string;
  workflow_id: string;
  vendor_data: string;
}

Deno.serve(async (req) => {
  try {
    const body = await req.text();
    if (!(await isSignedByDidit(body, req.headers.get('x-signature') ?? ''))) {
      return new Response('Unauthorized', { status: 401 });
    }
    const event: DiditEvent = JSON.parse(body);
    if (Math.abs(Date.now() / 1000 - event.timestamp) > MAX_AGE_SECONDS) {
      return new Response('Too old', { status: 401 });
    }

    // Other statuses (declined, in review, abandoned) need nothing from us: the user stays
    // `approved` and can try again.
    if (
      event.webhook_type !== 'status.updated' ||
      event.workflow_id !== env('DIDIT_WORKFLOW_ID') ||
      event.status !== 'Approved'
    ) {
      return new Response('Nothing to do');
    }
    const activated = await completeAgeVerification(event.vendor_data);
    return new Response(activated ? 'Activated' : 'Nothing to do');
  } catch (error) {
    // A 5xx makes Didit retry.
    console.error('Could not handle a Didit webhook', error);
    return new Response('Failed', { status: 500 });
  }
});

/** Didit's `X-Signature`: the hex HMAC-SHA256 of the raw body, with the webhook secret. */
async function isSignedByDidit(body: string, signature: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(env('DIDIT_WEBHOOK_SECRET')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(body)));
  const expected = encoder.encode(Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join(''));
  const given = encoder.encode(signature.toLowerCase());
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Whether the profile was activated (false if it wasn't waiting for an age check). */
async function completeAgeVerification(userId: string): Promise<boolean> {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/complete_age_verification`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_user_id: userId }),
  });
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
  return response.json();
}

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
}
