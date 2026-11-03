import { computed, inject, Injectable, signal } from '@angular/core';
import { mockConversations } from '../../features/main/messages/messages.mock';
import { UserStorage } from '../user-storage';
import { ChatMessage, Conversation, lastMessage, unreadCount } from './connections.model';

const MOCK_SEND_MS = 700;

/** Each conversation's unsent text, under its own key in UserStorage. */
function draftKey(id: string): string {
  return `messages.draft.${id}`;
}

function newestFirst(a: Conversation, b: Conversation): number {
  return (lastMessage(b)?.createdAt ?? '').localeCompare(lastMessage(a)?.createdAt ?? '');
}

/**
 * The viewer's conversations. Mock data for now: nothing here touches the backend, and the real
 * store will read from RxDB (see "Messaging sync" in docs/database.md). `?empty` in the URL shows
 * what a brand-new member sees. Provided by the main app, because the bottom nav shows the count:
 * unlike the rest of `core/`, it isn't app-wide.
 */
@Injectable()
export class ConnectionsStore {
  private readonly storage = inject(UserStorage);
  private readonly conversations = signal(
    mockConversations(new URLSearchParams(location.search).has('empty')),
  );

  /** The conversation with the admins. */
  readonly team = computed(() => this.conversations().find(({ isTeam }) => isTeam));
  /** Accepted and ended ones. A pending intro only joins them once it's accepted. */
  readonly conversationList = computed(() =>
    this.conversations()
      .filter(({ status }) => status !== 'pending')
      .sort(newestFirst),
  );
  /** Intros others sent the viewer, for the Connections tab. */
  readonly requests = computed(() =>
    this.conversations()
      .filter(
        ({ status, initiatedByMe, declined }) =>
          status === 'pending' && !initiatedByMe && !declined,
      )
      .sort(newestFirst),
  );
  /** The requests that have arrived since the viewer last opened the Connections tab. */
  readonly newRequests = computed(
    () => this.requests().filter(({ lastReadAt }) => lastReadAt === null).length,
  );
  readonly totalUnread = computed(() =>
    this.conversations()
      .filter(({ status }) => status !== 'pending')
      .reduce((total, conversation) => total + unreadCount(conversation), 0),
  );

  conversation(id: string | null): Conversation | undefined {
    return this.conversations().find(({ person }) => person.id === id);
  }

  markRead(id: string) {
    this.update(id, (conversation) => ({ ...conversation, lastReadAt: new Date().toISOString() }));
  }

  /** Opening the Connections tab counts as having seen every request in it. */
  markRequestsSeen() {
    this.requests()
      .filter(({ lastReadAt }) => lastReadAt === null)
      .forEach(({ person }) => this.markRead(person.id));
  }

  accept(id: string) {
    this.update(id, (conversation) => ({
      ...conversation,
      status: 'accepted',
      lastReadAt: new Date().toISOString(),
    }));
  }

  /** Undoable, so nothing should reach the server before the snackbar has gone. */
  setDeclined(id: string, declined: boolean) {
    this.update(id, (conversation) => ({ ...conversation, declined }));
  }

  draft(id: string): string {
    return this.storage.get<string>(draftKey(id)) ?? '';
  }

  saveDraft(id: string, text: string) {
    if (text.trim()) {
      this.storage.set(draftKey(id), text);
    } else {
      this.storage.remove(draftKey(id));
    }
  }

  send(id: string, text: string) {
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      mine: true,
      content: { type: 'text', text },
      createdAt: new Date().toISOString(),
      delivery: 'sending',
    };
    this.update(id, (conversation) => ({
      ...conversation,
      messages: [...conversation.messages, message],
    }));
    this.deliverLater(id, message.id);
  }

  retry(id: string, messageId: string) {
    this.setDelivery(id, messageId, 'sending');
    this.deliverLater(id, messageId);
  }

  end(id: string) {
    this.saveDraft(id, '');
    const ended: ChatMessage = {
      id: crypto.randomUUID(),
      mine: true,
      content: { type: 'ended' },
      createdAt: new Date().toISOString(),
    };
    this.update(id, (conversation) => ({
      ...conversation,
      status: 'ended',
      messages: [...conversation.messages, ended],
    }));
  }

  private deliverLater(id: string, messageId: string) {
    setTimeout(() => this.setDelivery(id, messageId, undefined), MOCK_SEND_MS);
  }

  private setDelivery(id: string, messageId: string, delivery: ChatMessage['delivery']) {
    this.update(id, (conversation) => ({
      ...conversation,
      messages: conversation.messages.map((message) =>
        message.id === messageId ? { ...message, delivery } : message,
      ),
    }));
  }

  private update(id: string, change: (conversation: Conversation) => Conversation) {
    this.conversations.update((conversations) =>
      conversations.map((conversation) =>
        conversation.person.id === id ? change(conversation) : conversation,
      ),
    );
  }
}
