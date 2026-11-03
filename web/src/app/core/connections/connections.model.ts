import { Member } from '../profile.model';

/** `messages.content` (see docs/database.md). */
export type MessageContent = { type: 'text'; text: string } | { type: 'ended' };

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
  /** The conversation with the admins: can't be ended, starts without an intro. */
  isTeam: boolean;
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
 * connection they've never opened. The conversation with the team starts without messages, so
 * it doesn't count until someone writes.
 */
function isNewConnection({ status, lastReadAt, messages }: Conversation): boolean {
  return status === 'accepted' && lastReadAt === null && messages.length > 0;
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
  const { isTeam, initiatedByMe, messages, person } = conversation;
  const message = lastMessage(conversation);
  if (!message) return isTeam ? 'Questions or feedback? Write to us.' : '';
  if (message.content.type === 'ended') {
    return message.mine ? 'You ended this connection' : `${person.name} ended this connection`;
  }
  if (message.delivery === 'failed') return `Not sent: ${message.content.text}`;
  if (messages.length === 1 && !isTeam) {
    return initiatedByMe
      ? `${person.name} accepted your introduction`
      : "You're connected. Say hello!";
  }
  return message.mine ? `You: ${message.content.text}` : message.content.text;
}
