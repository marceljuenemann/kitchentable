// Starts an age check for the signed-in user (see "Age verification" in docs/database.md): creates
// a Didit session and returns the URL of Didit's page, which the app sends the user to. Didit then
// sends the result to didit-webhook, and the user back to the app.
//
// Called by the app with the user's JWT (verified by the gateway). The user id sent to Didit
// comes from their profile, read with that JWT, so it can't be anyone else's.
//
// Environment (supabase/functions/.env locally, `supabase secrets set` on staging, see README):
// - DIDIT_API_KEY: the Didit application's API key. Not set locally, see README.
// - DIDIT_WORKFLOW_ID: the age verification workflow
// - SITE_URL: the frontend, where Didit sends the user back to
// SUPABASE_URL and SUPABASE_ANON_KEY are set by Supabase.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  try {
    const profile = await getMyProfile(req.headers.get('Authorization') ?? '');
    if (profile?.status !== 'approved') {
      return new Response('Not waiting for an age check', { status: 409, headers: CORS });
    }

    const response = await fetch('https://verification.didit.me/v3/session/', {
      method: 'POST',
      headers: { 'x-api-key': env('DIDIT_API_KEY'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflow_id: env('DIDIT_WORKFLOW_ID'),
        vendor_data: profile.id,
        // Didit adds `verificationSessionId` and `status` (only a hint for the UI).
        callback: `${env('SITE_URL')}/app`,
      }),
    });
    if (!response.ok) throw new Error(`Didit: ${response.status}: ${await response.text()}`);
    const { url } = await response.json();
    return Response.json({ url }, { headers: CORS });
  } catch (error) {
    console.error('Could not start an age check', error);
    return new Response('Failed', { status: 500, headers: CORS });
  }
});

async function getMyProfile(authorization: string): Promise<{ id: string; status: string } | null> {
  const response = await fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/get_my_profile`, {
    method: 'POST',
    headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: authorization },
  });
  if (!response.ok) throw new Error(`get_my_profile: ${response.status}: ${await response.text()}`);
  return response.json();
}

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
}
