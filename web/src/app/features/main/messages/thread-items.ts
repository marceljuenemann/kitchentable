import { ChatMessage, Conversation } from '../../../core/connections/connections.model';
import { dayLabel, isSameDay } from './message-time';

const GROUP_WINDOW_MS = 5 * 60_000;

export type ThreadItem =
  | { kind: 'intro'; key: string; message: ChatMessage }
  | { kind: 'connected'; key: string }
  | { kind: 'unread'; key: string }
  | { kind: 'day'; key: string; label: string }
  | { kind: 'ended'; key: string; message: ChatMessage }
  | {
      kind: 'message';
      key: string;
      message: ChatMessage;
      startsGroup: boolean;
      endsGroup: boolean;
    };

/** Whether `b` follows `a` as part of the same burst of messages, in one group of bubbles. */
function grouped(a: ChatMessage, b: ChatMessage): boolean {
  return (
    a.mine === b.mine &&
    a.content.type === 'text' &&
    b.content.type === 'text' &&
    Date.parse(b.createdAt) - Date.parse(a.createdAt) < GROUP_WINDOW_MS &&
    isSameDay(a.createdAt, b.createdAt)
  );
}

/**
 * What a conversation shows, top to bottom. A member's first message is their intro. A line marks
 * where `unreadFromId` starts, which is the first message that was unread on opening.
 */
export function threadItems(
  conversation: Conversation,
  now = new Date(),
  unreadFromId: string | null = null,
): ThreadItem[] {
  const intro = conversation.withAdmins ? undefined : conversation.messages[0];
  const messages = intro ? conversation.messages.slice(1) : conversation.messages;
  const items: ThreadItem[] = [];

  if (intro) {
    items.push({ kind: 'intro', key: intro.id, message: intro });
    if (conversation.status !== 'pending') items.push({ kind: 'connected', key: 'connected' });
  }

  messages.forEach((message, index) => {
    const before = messages[index - 1];
    const after = messages[index + 1];
    const dayBefore = before ?? intro;
    const startsUnread = message.id === unreadFromId;
    if (startsUnread) items.push({ kind: 'unread', key: 'unread' });
    if (!dayBefore || !isSameDay(dayBefore.createdAt, message.createdAt)) {
      items.push({
        kind: 'day',
        key: `day-${message.id}`,
        label: dayLabel(message.createdAt, now),
      });
    }
    if (message.content.type === 'ended') {
      items.push({ kind: 'ended', key: message.id, message });
    } else {
      items.push({
        kind: 'message',
        key: message.id,
        message,
        startsGroup: !before || startsUnread || !grouped(before, message),
        endsGroup: !after || after.id === unreadFromId || !grouped(message, after),
      });
    }
  });
  return items;
}
