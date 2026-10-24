/**
 * The invite code a member shares with friends: the first 8 hex digits of the SHA-256 of their
 * user id. It isn't secret or validated; it just lets whoever vets an application see who sent
 * the invite (see "Invite codes" in docs/database.md).
 */
export async function inviteCodeFor(userId: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(userId));
  return Array.from(new Uint8Array(digest).slice(0, 4), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}
