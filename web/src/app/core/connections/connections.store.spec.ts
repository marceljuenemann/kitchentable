import { TestBed } from '@angular/core/testing';
import { UserStorage } from '../user-storage';
import { lastMessage } from './connections.model';
import { ConnectionsStore } from './connections.store';

describe('ConnectionsStore', () => {
  let store: ConnectionsStore;
  let stored: Map<string, unknown>;

  beforeEach(() => {
    jasmine.clock().install();
    stored = new Map();
    TestBed.configureTestingModule({
      providers: [
        ConnectionsStore,
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
    store = TestBed.inject(ConnectionsStore);
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

  it('lists requests sent to the viewer, not the ones they sent', () => {
    const ids = store.requests().map(({ person }) => person.id);

    expect(ids).toEqual(['maya', 'sami', 'ellie']);
  });

  it('counts requests as new until the tab is opened', () => {
    expect(store.newRequests()).toBe(2);

    store.markRequestsSeen();

    expect(store.newRequests()).toBe(0);
    expect(store.requests().length).toBe(3);
  });

  it('leaves requests that were already seen alone', () => {
    const seenAt = store.conversation('ellie')?.lastReadAt;
    spyOn(store, 'markRead').and.callThrough();

    store.markRequestsSeen();

    expect(store.markRead).toHaveBeenCalledTimes(2);
    expect(store.markRead).not.toHaveBeenCalledWith('ellie');
    expect(store.conversation('ellie')?.lastReadAt).toBe(seenAt);
  });

  it('keeps requests out of the messages list and its unread count', () => {
    const before = store.totalUnread();

    store.markRequestsSeen();

    expect(store.totalUnread()).toBe(before);
    expect(store.conversationList().map(({ person }) => person.id)).not.toContain('maya');
  });

  it('turns an accepted request into a read conversation', () => {
    const before = store.totalUnread();

    store.accept('maya');

    expect(store.requests().map(({ person }) => person.id)).not.toContain('maya');
    expect(store.conversationList().map(({ person }) => person.id)).toContain('maya');
    expect(store.totalUnread()).toBe(before);
  });

  it('takes a declined request off the list, and puts it back on undo', () => {
    store.setDeclined('maya', true);
    expect(store.requests().map(({ person }) => person.id)).not.toContain('maya');
    expect(store.newRequests()).toBe(1);

    store.setDeclined('maya', false);
    expect(store.requests().map(({ person }) => person.id)).toContain('maya');
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
