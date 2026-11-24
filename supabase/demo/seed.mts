// Fills the LOCAL Kitchen Table database with demo data, for trying things out and for screen
// recordings (see "Demo data" in README.md):
//  1. deletes every e2e user (@example.com) and any earlier demo cast, with their photo files,
//  2. creates the animal cast from cast.mts (live members, plus applicants in vetting),
//  3. gives Prickles, the member to sign in as, a conversation with Hammy and an intro from Hoot.
// Run with `npm run seed:demo` (Node runs the TypeScript directly). It can be run again at any
// time, and only ever talks to a local Supabase stack.

import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { MEMBERS, APPLICANTS, PRICKLES, INTRO, CONVERSATION, type CastMember } from './cast.mts';

/** The local stack's API, or another local one (`DEMO_API_URL`), never a hosted project. */
const API_URL = process.env['DEMO_API_URL'] ?? 'http://127.0.0.1:54321';
if (!['127.0.0.1', 'localhost'].includes(new URL(API_URL).hostname)) {
  throw new Error(`Refusing to seed ${API_URL}: demo data is for local stacks only.`);
}
// The Supabase CLI's well-known local service-role key (same on every machine, not a secret).
const KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

/** Each cast member's address is `<key>@` this, so they can sign in (the links go to Mailpit). */
const CAST_DOMAIN = 'demo.kitchentable.test';
const E2E_DOMAIN = 'example.com';
const PHOTOS = new URL('./photos/', import.meta.url);

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function api(
  path: string,
  body?: unknown,
  method = 'POST',
  extra: Record<string, string> = {},
) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: { ...headers, 'Content-Type': 'application/json', ...extra },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} failed (${response.status}): ${text}`);
  return text ? JSON.parse(text) : null;
}

/** Runs `fn` over `items`, `limit` at a time. */
async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<unknown>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: limit }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) await fn(item);
    }),
  );
}

interface AuthUser {
  id: string;
  email: string;
}

async function allUsers(): Promise<AuthUser[]> {
  const users: AuthUser[] = [];
  for (let page = 1; ; page++) {
    const batch = (await api(`/auth/v1/admin/users?page=${page}&per_page=1000`, undefined, 'GET'))
      .users as AuthUser[];
    users.push(...batch);
    if (batch.length < 1000) return users;
  }
}

/** Paths of every file under the user's folder of the photos bucket (`<user>/<photo>/<file>`). */
async function photoPaths(userId: string): Promise<string[]> {
  const list = (prefix: string) =>
    api('/storage/v1/object/list/photos', { prefix, limit: 1000, offset: 0 }) as Promise<
      { name: string }[]
    >;
  const paths: string[] = [];
  for (const folder of await list(`${userId}/`)) {
    for (const file of await list(`${userId}/${folder.name}/`)) {
      paths.push(`${userId}/${folder.name}/${file.name}`);
    }
  }
  return paths;
}

async function deleteUsers(users: AuthUser[]) {
  const paths: string[] = [];
  await pool(users, 16, async (user) => paths.push(...(await photoPaths(user.id))));
  for (let i = 0; i < paths.length; i += 500) {
    await api('/storage/v1/object/photos', { prefixes: paths.slice(i, i + 500) }, 'DELETE');
  }
  // Profiles, connections, messages, secrets and terms acceptances cascade from auth.users.
  const real = users.filter((user) => user.email);
  await pool(real, 16, (user) => api(`/auth/v1/admin/users/${user.id}`, undefined, 'DELETE'));
  console.log(`Deleted ${real.length} users and ${paths.length} photo files.`);
}

async function uploadPhoto(path: string, file: URL) {
  const response = await fetch(`${API_URL}/storage/v1/object/photos/${path}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'image/jpeg' },
    body: readFileSync(file),
  });
  if (!response.ok) throw new Error(`Uploading ${path} failed: ${await response.text()}`);
}

function check(member: CastMember) {
  if (member.bio.length < 250) throw new Error(`${member.key}: bio under 250 characters`);
  if (member.tagline.length > 60) throw new Error(`${member.key}: tagline over 60 characters`);
}

/** Creates the user, uploads the photos and inserts the profile in the given status. */
async function createProfile(
  member: CastMember,
  status: 'approved' | 'vetting',
  vettingAnswers: Record<string, string> = {},
): Promise<string> {
  check(member);
  const user = await api('/auth/v1/admin/users', {
    email: `${member.key}@${CAST_DOMAIN}`,
    email_confirm: true,
    user_metadata: { invite_code: 'DEMO-INVITE' },
  });
  await api('/rest/v1/terms_acceptances', { user_id: user.id, version: 1 });

  const photoIds = member.photos.map(() => randomUUID());
  await Promise.all(
    member.photos.flatMap((key, i) =>
      ['full', 'thumb'].map((version) =>
        uploadPhoto(
          `${user.id}/${photoIds[i]}/${version}.jpg`,
          new URL(`${key}/${version}.jpg`, PHOTOS),
        ),
      ),
    ),
  );

  await api('/rest/v1/profiles', {
    id: user.id,
    status,
    name: member.name,
    pronouns: member.pronouns,
    tagline: member.tagline,
    bio: member.bio,
    location: 'London',
    gender: member.gender,
    sexuality: member.sexuality,
    birth_year: member.born?.[0] ?? null,
    birth_month: member.born?.[1] ?? null,
    looking_for: member.looking_for,
    photos: photoIds,
    vetting_answers: vettingAnswers,
  });
  return user.id;
}

/** Makes an approved profile live as the age check would (which also opens the team conversation). */
async function goLive(id: string, verifiedAt: Date) {
  await api(
    `/rest/v1/profiles?id=eq.${id}`,
    { status: 'active', age_verified_at: verifiedAt },
    'PATCH',
  );
}

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000);

async function main() {
  const users = await allUsers();

  // Folders in the bucket whose user is already gone (e2e leftovers): deleted with the users.
  const folders = (await api('/storage/v1/object/list/photos', {
    prefix: '',
    limit: 100000,
    offset: 0,
  })) as { name: string }[];
  const orphans = folders
    .filter((folder) => !users.some((user) => user.id === folder.name))
    .map((folder) => ({ id: folder.name, email: '' }));
  const doomed = users.filter(
    (u) => u.email.endsWith(`@${E2E_DOMAIN}`) || u.email.endsWith(`@${CAST_DOMAIN}`),
  );
  await deleteUsers([...doomed, ...orphans]);

  // Members: the first in the list went live most recently, so search shows them first.
  const memberIds = new Map<string, string>();
  await pool(
    MEMBERS.map((member, i) => ({ member, i })),
    4,
    async ({ member, i }) => {
      const id = await createProfile(member, 'approved');
      await goLive(id, ago(60 * 24 * 3 + i * 97));
      memberIds.set(member.key, id);
    },
  );
  console.log(`Created ${MEMBERS.length} members.`);

  for (const applicant of APPLICANTS) {
    await createProfile(applicant, 'vetting', applicant.vetting_answers);
  }
  console.log(`Created ${APPLICANTS.length} applicants.`);

  const pricklesId = await createProfile(PRICKLES, 'approved');
  await goLive(pricklesId, ago(60 * 24 * 2));
  await seedPrickles(pricklesId, memberIds.get(CONVERSATION.with)!, memberIds.get(INTRO.from)!);

  console.log(
    `Sign in as ${PRICKLES.key}@${CAST_DOMAIN} (the link is in Mailpit), or as any other ` +
      `member: <name>@${CAST_DOMAIN}.`,
  );
}

/** Prickles' conversation, which she started, and an intro to her. */
async function seedPrickles(pricklesId: string, otherId: string, introFromId: string) {
  // The conversation: accepted, with the latest messages unread.
  const at = (minutesAgo: number) => ago(minutesAgo).toISOString();
  const [first] = CONVERSATION.messages;
  await api('/rest/v1/connections', {
    initiator_id: pricklesId,
    recipient_id: otherId,
    status: 'accepted',
    looking_for: CONVERSATION.looking_for,
    created_at: at(first.minutesAgo),
    updated_at: at(CONVERSATION.messages[1].minutesAgo),
  });
  await api(
    '/rest/v1/messages',
    CONVERSATION.messages.map((message) => ({
      sender_id: message.from === 'me' ? pricklesId : otherId,
      recipient_id: message.from === 'me' ? otherId : pricklesId,
      content: { type: 'text', text: message.text },
      created_at: at(message.minutesAgo),
      updated_at: at(message.minutesAgo),
    })),
  );
  const lastRead = CONVERSATION.messages[CONVERSATION.readUpTo - 1];
  await api('/rest/v1/connection_secrets', [
    { user_id: pricklesId, other_user_id: otherId, last_read_at: at(lastRead.minutesAgo - 1) },
    { user_id: otherId, other_user_id: pricklesId, last_read_at: at(lastRead.minutesAgo - 10) },
  ]);
  const unread = CONVERSATION.messages.length - CONVERSATION.readUpTo;
  console.log(`Connected Prickles with ${CONVERSATION.with}, ${unread} messages unread.`);

  // The intro, as send_intro makes it, a couple of hours ago.
  const sentAt = ago(130).toISOString();
  await api('/rest/v1/connections', {
    initiator_id: introFromId,
    recipient_id: pricklesId,
    looking_for: INTRO.looking_for,
    created_at: sentAt,
    updated_at: sentAt,
  });
  await api('/rest/v1/messages', {
    sender_id: introFromId,
    recipient_id: pricklesId,
    content: { type: 'text', text: INTRO.text },
    created_at: sentAt,
    updated_at: sentAt,
  });
  await api('/rest/v1/connection_secrets', [
    { user_id: introFromId, other_user_id: pricklesId },
    { user_id: pricklesId, other_user_id: introFromId },
  ]);
  console.log(`Sent Prickles an intro from ${INTRO.from}.`);
}

await main();
