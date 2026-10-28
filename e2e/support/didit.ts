import { createHmac } from 'node:crypto';

const FUNCTIONS_URL = `${process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'}/functions/v1`;
// The local stand-ins from supabase/functions/.env.
const WEBHOOK_SECRET = 'local-didit-webhook-secret';
const WORKFLOW_ID = 'local-age-verification-workflow';

/**
 * Sends the didit-webhook function a status update for the user's age check, as Didit would:
 * signed with the local webhook secret unless told otherwise.
 */
export async function sendDiditWebhook(
  userId: string,
  status: string,
  {
    secret = WEBHOOK_SECRET,
    workflowId = WORKFLOW_ID,
    timestamp = Math.floor(Date.now() / 1000),
  } = {},
): Promise<Response> {
  const body = JSON.stringify({
    webhook_type: 'status.updated',
    timestamp,
    session_id: 'e2e-session',
    status,
    workflow_id: workflowId,
    vendor_data: userId,
  });
  return fetch(`${FUNCTIONS_URL}/didit-webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': createHmac('sha256', secret).update(body).digest('hex'),
    },
    body,
  });
}
