import {
  ChatMessage,
  Conversation,
  MessageContent,
  previewOf,
  unreadCount,
} from '../../../core/connections/connections.model';
import { Member } from '../../../core/profile.model';
import { ThreadItem, threadItems } from './thread-items';

const NOW = new Date(2026, 10, 2, 12, 0);

function at(day: number, hour: number, minute = 0): string {
  return new Date(2026, 10, day, hour, minute).toISOString();
}

function message(id: string, mine: boolean, createdAt: string): ChatMessage {
  const content: MessageContent = { type: 'text', text: id };
  return { id, mine, content, createdAt };
}

function conversation(fields: Partial<Conversation>): Conversation {
  return {
    person: { id: 'them', name: 'Noor' } as Member,
    photoUrl: null,
    isTeam: false,
    status: 'accepted',
    initiatedByMe: true,
    lookingFor: ['friends'],
    lastReadAt: null,
    messages: [],
    ...fields,
  };
}

function kinds(items: ThreadItem[]): string[] {
  return items.map(({ kind }) => kind);
}

describe('threadItems', () => {
  it('starts a member’s conversation with the intro', () => {
    const items = threadItems(conversation({ messages: [message('intro', true, at(2, 9))] }), NOW);

    expect(kinds(items)).toEqual(['intro', 'connected']);
  });

  it('shows no "connected" line while an intro is pending', () => {
    const items = threadItems(
      conversation({ status: 'pending', messages: [message('intro', true, at(2, 9))] }),
      NOW,
    );

    expect(kinds(items)).toEqual(['intro']);
  });

  it('has no intro in the conversation with the team', () => {
    const items = threadItems(
      conversation({ isTeam: true, messages: [message('hello', true, at(2, 9))] }),
      NOW,
    );

    expect(kinds(items)).toEqual(['day', 'message']);
  });

  it('labels a new day, but not the day of the intro again', () => {
    const items = threadItems(
      conversation({
        messages: [
          message('intro', true, at(1, 9)),
          message('same day', false, at(1, 10)),
          message('next day', false, at(2, 9)),
        ],
      }),
      NOW,
    );

    expect(items.flatMap((item) => (item.kind === 'day' ? [item.label] : []))).toEqual(['Today']);
  });

  it('groups a burst from one sender, not from both or far apart', () => {
    const items = threadItems(
      conversation({
        messages: [
          message('intro', true, at(2, 8)),
          message('a', false, at(2, 9, 0)),
          message('b', false, at(2, 9, 2)),
          message('c', true, at(2, 9, 3)),
          message('d', true, at(2, 9, 30)),
        ],
      }),
      NOW,
    );

    const groups = items.flatMap((item) =>
      item.kind === 'message' ? [[item.message.id, item.startsGroup, item.endsGroup]] : [],
    );
    expect(groups).toEqual([
      ['a', true, false],
      ['b', false, true],
      ['c', true, true],
      ['d', true, true],
    ]);
  });

  it('marks where the unread messages start, splitting a group there', () => {
    const items = threadItems(
      conversation({
        messages: [
          message('intro', true, at(2, 8)),
          message('read', false, at(2, 9, 0)),
          message('unread', false, at(2, 9, 2)),
        ],
      }),
      NOW,
      'unread',
    );

    expect(kinds(items)).toEqual(['intro', 'connected', 'message', 'unread', 'message']);
    const groups = items.flatMap((item) =>
      item.kind === 'message' ? [[item.startsGroup, item.endsGroup]] : [],
    );
    expect(groups).toEqual([
      [true, true],
      [true, true],
    ]);
  });

  it('shows the end of a connection as an event', () => {
    const ended: ChatMessage = {
      id: 'ended',
      mine: false,
      content: { type: 'ended' },
      createdAt: at(2, 9),
    };
    const items = threadItems(
      conversation({ status: 'ended', messages: [message('intro', true, at(2, 8)), ended] }),
      NOW,
    );

    expect(kinds(items)).toEqual(['intro', 'connected', 'ended']);
  });
});

describe('unreadCount', () => {
  it('counts the other person’s messages after the watermark', () => {
    const messages = [
      message('old', false, at(1, 9)),
      message('new', false, at(2, 9)),
      message('mine', true, at(2, 10)),
    ];

    expect(unreadCount(conversation({ messages, lastReadAt: at(1, 12) }))).toBe(1);
    expect(unreadCount(conversation({ messages, lastReadAt: null }))).toBe(2);
  });

  it('counts an accepted intro its sender hasn’t opened yet', () => {
    const messages = [message('intro', true, at(1, 9))];

    expect(unreadCount(conversation({ messages, lastReadAt: null }))).toBe(1);
    expect(unreadCount(conversation({ messages, lastReadAt: at(2, 9) }))).toBe(0);
  });

  it('doesn’t count a pending intro the viewer sent', () => {
    const messages = [message('intro', true, at(1, 9))];

    expect(unreadCount(conversation({ status: 'pending', messages }))).toBe(0);
  });

  it('doesn’t count the team’s conversation before anyone has written', () => {
    expect(unreadCount(conversation({ isTeam: true }))).toBe(0);
  });
});

describe('previewOf', () => {
  it('marks your own message', () => {
    const messages = [message('intro', false, at(1, 9)), message('hello', true, at(2, 9))];

    expect(previewOf(conversation({ messages }))).toBe('You: hello');
  });

  it('prompts a hello when you accepted and only the intro is there', () => {
    const messages = [message('intro', false, at(1, 9))];

    expect(previewOf(conversation({ initiatedByMe: false, messages }))).toBe(
      "You're connected. Say hello!",
    );
  });

  it('says so when your intro was accepted', () => {
    const messages = [message('intro', true, at(1, 9))];

    expect(previewOf(conversation({ messages }))).toBe('Noor accepted your introduction');
  });

  it('flags a message that wasn’t sent', () => {
    const failed: ChatMessage = { ...message('hello', true, at(2, 9)), delivery: 'failed' };

    expect(previewOf(conversation({ messages: [message('intro', false, at(1, 9)), failed] }))).toBe(
      'Not sent: hello',
    );
  });

  it('invites a first message to the team', () => {
    expect(previewOf(conversation({ isTeam: true }))).toContain('Write to us');
  });
});
