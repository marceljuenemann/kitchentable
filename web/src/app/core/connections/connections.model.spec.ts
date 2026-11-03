import { Member } from '../profile.model';
import {
  ConnectedProfile,
  ConnectionRow,
  introDayStart,
  introsSentToday,
  MessageRow,
  SecretRow,
  toConversations,
  unreadCount,
} from './connections.model';

const ME = 'me';

function profile(id: string, isAdmin = false): ConnectedProfile {
  const member: Member = {
    id,
    name: id,
    pronouns: '',
    tagline: '',
    bio: '',
    location: 'London',
    gender: [],
    sexuality: [],
    looking_for: [],
    photos: [],
    age: null,
  };
  return { ...member, is_admin: isAdmin };
}

function connection(fields: Partial<ConnectionRow>): ConnectionRow {
  return {
    initiator_id: 'ivy',
    recipient_id: ME,
    status: 'accepted',
    looking_for: ['friends'],
    created_at: '2026-11-01T10:00:00+00:00',
    updated_at: '2026-11-01T10:00:00+00:00',
    ...fields,
  };
}

function secret(other: string, fields: Partial<SecretRow> = {}): SecretRow {
  return {
    user_id: ME,
    other_user_id: other,
    dismissed_at: null,
    declined_at: null,
    last_read_at: null,
    updated_at: '2026-11-01T10:00:00+00:00',
    ...fields,
  };
}

function message(id: string, from: string, to: string, createdAt: string): MessageRow {
  return {
    id,
    sender_id: from,
    recipient_id: to,
    content: { type: 'text', text: id },
    created_at: createdAt,
    updated_at: createdAt,
  };
}

describe('toConversations', () => {
  const profiles = new Map([
    ['ivy', profile('ivy')],
    ['team', profile('team', true)],
  ]);

  it('builds one per connection, from the viewer’s side, with its messages oldest first', () => {
    const [conversation] = toConversations(
      ME,
      [connection({ initiator_id: ME, recipient_id: 'ivy' })],
      [secret('ivy')],
      [
        message('second', 'ivy', ME, '2026-11-01T11:00:00.123456+00:00'),
        message('intro', ME, 'ivy', '2026-11-01T10:00:00+00:00'),
        message('elsewhere', 'team', ME, '2026-11-01T09:00:00+00:00'),
      ],
      profiles,
      new Map([['ivy', 'https://photo']]),
    );

    expect(conversation.person.id).toBe('ivy');
    expect(conversation.photoUrl).toBe('https://photo');
    expect(conversation.initiatedByMe).toBeTrue();
    expect(conversation.isTeam).toBeFalse();
    expect(conversation.messages.map(({ id, mine }) => [id, mine])).toEqual([
      ['intro', true],
      ['second', false],
    ]);
    // In one format, whatever the server's precision.
    expect(conversation.messages[1].createdAt).toBe('2026-11-01T11:00:00.123Z');
  });

  it('leaves out connections whose profile has not loaded yet', () => {
    expect(toConversations(ME, [connection({ initiator_id: 'kim' })], [], [], profiles, new Map()))
      .withContext('kim has no profile')
      .toEqual([]);
  });

  it('marks the conversation with the admins, without its flag on the person', () => {
    const [team] = toConversations(
      ME,
      [connection({ initiator_id: 'team', looking_for: [] })],
      [],
      [],
      profiles,
      new Map(),
    );
    expect(team.isTeam).toBeTrue();
    expect(team.withAdmins).toBeTrue();
    expect('is_admin' in team.person).toBeFalse();
  });

  it('marks an admin’s conversations with members as with the admins, not as the team', () => {
    const [member] = toConversations(
      'team',
      [connection({ initiator_id: 'team', recipient_id: 'ivy', looking_for: [] })],
      [],
      [],
      profiles,
      new Map(),
    );
    expect(member.isTeam).toBeFalse();
    expect(member.withAdmins).toBeTrue();
  });

  it('treats any other connection as an intro', () => {
    const [intro] = toConversations(ME, [connection({})], [], [], profiles, new Map());
    expect(intro.withAdmins).toBeFalse();
  });

  it('takes read state and declining from the viewer’s secrets', () => {
    const [conversation] = toConversations(
      ME,
      [connection({ status: 'pending' })],
      [secret('ivy', { last_read_at: '2026-11-01T12:00:00+00:00', declined_at: 'x' })],
      [],
      profiles,
      new Map(),
    );
    expect(conversation.lastReadAt).toBe('2026-11-01T12:00:00.000Z');
    expect(conversation.declined).toBeTrue();
  });

  it('shows messages the server doesn’t have yet as sending, and refused ones as failed', () => {
    const local = { ...message('local', ME, 'ivy', '2026-11-01T12:00:00.000Z') };
    delete local.updated_at;
    const refused = { ...local, id: 'refused', failed: true };
    const [conversation] = toConversations(
      ME,
      [connection({})],
      [],
      [message('sent', ME, 'ivy', '2026-11-01T11:00:00+00:00'), local, refused],
      profiles,
      new Map(),
    );
    expect(conversation.messages.map(({ id, delivery }) => [id, delivery])).toEqual([
      ['sent', undefined],
      ['local', 'sending'],
      ['refused', 'failed'],
    ]);
  });

  it('counts unread messages against the watermark, whatever the timestamps’ format', () => {
    const [conversation] = toConversations(
      ME,
      [connection({})],
      [secret('ivy', { last_read_at: '2026-11-01T11:00:00.500Z' })],
      [
        message('read', 'ivy', ME, '2026-11-01T11:00:00.499999+00:00'),
        message('unread', 'ivy', ME, '2026-11-01T11:00:01+00:00'),
        message('mine', ME, 'ivy', '2026-11-01T11:00:02+00:00'),
      ],
      profiles,
      new Map(),
    );
    expect(unreadCount(conversation)).toBe(1);
  });
});

describe('intros per day', () => {
  it('starts the day at 3am UTC', () => {
    expect(introDayStart(new Date('2026-11-03T03:00:00Z')).toISOString()).toBe(
      '2026-11-03T03:00:00.000Z',
    );
    expect(introDayStart(new Date('2026-11-03T02:59:59Z')).toISOString()).toBe(
      '2026-11-02T03:00:00.000Z',
    );
    expect(introDayStart(new Date('2026-11-03T23:00:00Z')).toISOString()).toBe(
      '2026-11-03T03:00:00.000Z',
    );
  });

  it('counts the intros the viewer sent since then', () => {
    const now = new Date('2026-11-03T12:00:00Z');
    const connections = [
      connection({ initiator_id: ME, created_at: '2026-11-03T03:00:00+00:00' }),
      connection({ initiator_id: ME, created_at: '2026-11-03T11:00:00.5+00:00' }),
      connection({ initiator_id: ME, created_at: '2026-11-03T02:59:59+00:00' }),
      connection({ initiator_id: 'ivy', created_at: '2026-11-03T11:00:00+00:00' }),
    ];
    expect(introsSentToday(ME, connections, now)).toBe(2);
  });
});
