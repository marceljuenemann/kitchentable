import { computed, inject, Injectable, signal } from '@angular/core';
import { UserStorage } from '../../../core/user-storage';
import { mockConversations } from './messages.mock';
import { ChatMessage, Conversation, lastMessage, unreadCount } from './messages.model';

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
 * what a brand-new member sees. Provided by the main app, because the bottom nav shows the count.
 */
@Injectable()
export class MessagesStore {
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
