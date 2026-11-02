import { TestBed } from '@angular/core/testing';
import { UserStorage } from '../../../core/user-storage';
import { lastMessage } from './messages.model';
import { MessagesStore } from './messages.store';

describe('MessagesStore', () => {
  let store: MessagesStore;
  let stored: Map<string, unknown>;

  beforeEach(() => {
    jasmine.clock().install();
    stored = new Map();
    TestBed.configureTestingModule({
      providers: [
        MessagesStore,
        {
          provide: UserStorage,
          useValue: {
            get: (key: string) => stored.get(key) ?? null,
            set: (key: string, value: unknown) => stored.set(key, value),
            remove: (key: string) => stored.delete(key),
          },
        },
      ],
    });
    store = TestBed.inject(MessagesStore);
  });

  afterEach(() => jasmine.clock().uninstall());

  it('lists the team with the others, and leaves out pending intros', () => {
    const ids = store.conversationList().map(({ person }) => person.id);

    expect(ids).toContain('team');
    expect(ids).not.toContain('priya');
  });

  it('counts a newly accepted intro as unread until it’s opened', () => {
    const before = store.totalUnread();

    store.markRead('tomasz');

    expect(store.totalUnread()).toBe(before - 1);
  });

  it('sorts conversations by their latest message', () => {
    const times = store.conversationList().map((item) => lastMessage(item)?.createdAt ?? '');

    expect(times).toEqual([...times].sort().reverse());
  });

  it('marks a conversation read, which lowers the total', () => {
    const before = store.totalUnread();

    store.markRead('noor');

    expect(store.totalUnread()).toBeLessThan(before);
  });

  it('shows a message straight away and clears its state once delivered', () => {
    store.send('noor', 'Hello');
    expect(lastMessage(store.conversation('noor')!)?.delivery).toBe('sending');

    jasmine.clock().tick(1000);

    expect(lastMessage(store.conversation('noor')!)?.delivery).toBeUndefined();
  });

  it('retries a failed message', () => {
    const failed = lastMessage(store.conversation('rowan')!)!;
    expect(failed.delivery).toBe('failed');

    store.retry('rowan', failed.id);
    jasmine.clock().tick(1000);

    expect(lastMessage(store.conversation('rowan')!)?.delivery).toBeUndefined();
  });

  it('keeps a draft per conversation', () => {
    store.saveDraft('noor', 'Hello Noor');
    store.saveDraft('rowan', 'Hello Rowan');

    expect(store.draft('noor')).toBe('Hello Noor');
    expect(store.draft('rowan')).toBe('Hello Rowan');
    expect(store.draft('tomasz')).toBe('');
  });

  it('forgets a draft that is emptied, or only whitespace', () => {
    store.saveDraft('noor', 'Hello');
    store.saveDraft('noor', '  \n');

    expect(stored.size).toBe(0);
  });

  it('forgets the draft of a connection that ends', () => {
    store.saveDraft('noor', 'Hello');

    store.end('noor');

    expect(store.draft('noor')).toBe('');
  });

  it('ends a connection with a message saying so', () => {
    store.end('noor');

    const conversation = store.conversation('noor')!;
    expect(conversation.status).toBe('ended');
    expect(lastMessage(conversation)?.content).toEqual({ type: 'ended' });
  });
});
