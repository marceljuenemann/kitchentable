import { Member } from '../profile.model';

/** The daily limit in `send_intro`. */
export const INTROS_PER_DAY = 3;

/** `messages.content` (see docs/database.md). */
export type MessageContent = { type: 'text'; text: string } | { type: 'ended' };

/** A `connections` row (see docs/database.md). */
export interface ConnectionRow {
  initiator_id: string;
  recipient_id: string;
  status: 'pending' | 'accepted' | 'ended';
  looking_for: string[];
  created_at: string;
  updated_at: string;
}

/** A `connection_secrets` row: always the viewer's own. */
export interface SecretRow {
  user_id: string;
  other_user_id: string;
  dismissed_at: string | null;
  declined_at: string | null;
  last_read_at: string | null;
  updated_at: string;
}

/** A `messages` row, or one written on this device that the server doesn't have yet. */
export interface MessageRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: MessageContent;
  created_at: string;
  /** Only once the server has it. */
  updated_at?: string;
  /** Only on this device: the server refused it. */
  failed?: boolean;
}

/** One of `get_connected_profiles()`. */
export interface ConnectedProfile extends Member {
  /** The conversation with the admins. */
  is_admin: boolean;
}

export interface ChatMessage {
  id: string;
  mine: boolean;
  content: MessageContent;
  createdAt: string;
  /** Only on this device: not on the server yet (`sending`), or refused by it (`failed`). */
  delivery?: 'sending' | 'failed';
}

/** A connection from the viewer's side, with its messages. The other person identifies it. */
export interface Conversation {
  person: Member;
  /** Their main photo. Null while it isn't available. */
  photoUrl: string | null;
  /** The other person is the team (the admins), so it shows as the team's. */
  isTeam: boolean;
  /**
   * A conversation with the admins, from either side: a member's with the team, or an admin's
   * with a member. It starts without an intro and can't be ended.
   */
  withAdmins: boolean;
  status: 'pending' | 'accepted' | 'ended';
  /** Whether the viewer sent the intro. */
  initiatedByMe: boolean;
  /** What the initiator wanted to connect on. */
  lookingFor: string[];
  /** The viewer's read watermark (`connection_secrets.last_read_at`). */
  lastReadAt: string | null;
  /** The viewer declined the intro (`connection_secrets.declined_at`). */
  declined?: boolean;
  /** Oldest first. In a member's conversation, the first one is the intro. */
  messages: ChatMessage[];
}

/** The same instant in one format, since the server's has microseconds and an offset. */
function normalized(time: string): string {
  return new Date(time).toISOString();
}

function toMessage(row: MessageRow, me: string): ChatMessage {
  const delivery = row.failed ? 'failed' : row.updated_at ? undefined : 'sending';
  return {
    id: row.id,
    mine: row.sender_id === me,
    content: row.content,
    createdAt: normalized(row.created_at),
    ...(delivery && { delivery }),
  };
}

/**
 * The viewer's conversations from the synced rows: one per connection whose person's profile has
 * loaded, with its messages oldest first.
 */
export function toConversations(
  me: string,
  connections: ConnectionRow[],
  secrets: SecretRow[],
  messages: MessageRow[],
  profiles: ReadonlyMap<string, ConnectedProfile>,
  photoUrls: ReadonlyMap<string, string | null>,
): Conversation[] {
  const secretsByPerson = new Map(secrets.map((secret) => [secret.other_user_id, secret]));
  const messagesByPerson = new Map<string, ChatMessage[]>();
  for (const row of messages) {
    const other = row.sender_id === me ? row.recipient_id : row.sender_id;
    const thread = messagesByPerson.get(other) ?? [];
    thread.push(toMessage(row, me));
    messagesByPerson.set(other, thread);
  }

  return connections.flatMap((connection) => {
    const initiatedByMe = connection.initiator_id === me;
    const other = initiatedByMe ? connection.recipient_id : connection.initiator_id;
    const profile = profiles.get(other);
    if (!profile) return [];
    const { is_admin, ...person } = profile;
    const secret = secretsByPerson.get(other);
    const thread = messagesByPerson.get(other) ?? [];
    thread.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return [
      {
        person,
        photoUrl: photoUrls.get(other) ?? null,
        isTeam: is_admin,
        // Intros always have something to connect on (`send_intro` checks), the connections with
        // the admins nothing: this works for admins too, whose conversations are all of this kind.
        withAdmins: connection.looking_for.length === 0,
        status: connection.status,
        initiatedByMe,
        lookingFor: connection.looking_for,
        lastReadAt: secret?.last_read_at ? normalized(secret.last_read_at) : null,
        declined: !!secret?.declined_at,
        messages: thread,
      },
    ];
  });
}

/** When the current day of intros started: days start at 3am UTC, as in `send_intro`. */
export function introDayStart(now: Date): Date {
  const start = new Date(now);
  start.setUTCHours(3, 0, 0, 0);
  if (start > now) start.setUTCDate(start.getUTCDate() - 1);
  return start;
}

/**
 * How many intros the viewer has sent today, counted like `send_intro` counts them (keep the two
 * in step). An intro sent from another device counts once it has synced; until then
 * `send_intro` still refuses one too many.
 */
export function introsSentToday(me: string, connections: ConnectionRow[], now: Date): number {
  const start = introDayStart(now).getTime();
  return connections.filter(
    (connection) => connection.initiator_id === me && Date.parse(connection.created_at) >= start,
  ).length;
}

/** What a member's intro says: their first message. */
export function introText({ messages }: Conversation): string {
  const content = messages[0]?.content;
  return content?.type === 'text' ? content.text : '';
}

export function lastMessage(conversation: Conversation): ChatMessage | undefined {
  return conversation.messages.at(-1);
}

/**
 * An accepted intro its sender hasn't seen yet. Accepting adds no message, so what shows it is a
 * connection they've never opened. A conversation with the admins has no intro: only its
 * messages count.
 */
function isNewConnection({ status, lastReadAt, messages, withAdmins }: Conversation): boolean {
  return !withAdmins && status === 'accepted' && lastReadAt === null && messages.length > 0;
}

function isUnread(message: ChatMessage, lastReadAt: string | null): boolean {
  return !message.mine && (lastReadAt === null || message.createdAt > lastReadAt);
}

export function unreadCount(conversation: Conversation): number {
  const { messages, lastReadAt } = conversation;
  const unread = messages.filter((message) => isUnread(message, lastReadAt)).length;
  return isNewConnection(conversation) ? Math.max(unread, 1) : unread;
}

export function firstUnread({ messages, lastReadAt }: Conversation): ChatMessage | undefined {
  return messages.find((message) => isUnread(message, lastReadAt));
}

/** The line under a person's name in the list of conversations. */
export function previewOf(conversation: Conversation): string {
  const { isTeam, withAdmins, initiatedByMe, messages, person } = conversation;
  const message = lastMessage(conversation);
  if (!message) return isTeam ? 'Questions or feedback? Write to us.' : '';
  if (message.content.type === 'ended') {
    return message.mine ? 'You ended this connection' : `${person.name} ended this connection`;
  }
  if (message.delivery === 'failed') return `Not sent: ${message.content.text}`;
  if (messages.length === 1 && !withAdmins) {
    return initiatedByMe
      ? `${person.name} accepted your introduction`
      : "You're connected. Say hello!";
  }
  return message.mine ? `You: ${message.content.text}` : message.content.text;
}
