import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { createRxDatabase, RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { AuthService } from '../auth/auth.service';
import { PhotoStorageService } from '../photo-storage.service';
import { SupabaseService } from '../supabase.service';
import { UserStorage } from '../user-storage';
import { COLLECTIONS, ConnectionsCollections, ConnectionsDb } from './connections-db';
import { ConnectedProfile, ConnectionRow, MessageRow, SecretRow } from './connections.model';
import { ConnectionsStore, OPEN_CONNECTIONS_DB } from './connections.store';

const ME = 'me';
const NOW = new Date().toISOString();

function profile(id: string, isAdmin = false): ConnectedProfile {
  return {
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
    is_admin: isAdmin,
  };
}

function connection(fields: Partial<ConnectionRow>): ConnectionRow {
  return {
    initiator_id: 'ivy',
    recipient_id: ME,
    status: 'accepted',
    looking_for: ['friends'],
    created_at: NOW,
    updated_at: NOW,
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
    updated_at: NOW,
    ...fields,
  };
}

function message(id: string, from: string, to: string): MessageRow {
  return {
    id,
    sender_id: from,
    recipient_id: to,
    content: { type: 'text', text: id },
    created_at: NOW,
    updated_at: NOW,
  };
}

/** Checks after each round of timers and effects, until it holds (or fails after a while). */
async function until(check: () => boolean, what: string) {
  for (let i = 0; i < 200; i++) {
    TestBed.tick();
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  fail(`Timed out waiting until ${what}`);
}

/** Lets pending work finish, for checking that something did *not* happen. */
async function settle() {
  for (let i = 0; i < 10; i++) {
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

let databases = 0;

describe('ConnectionsStore', () => {
  let rxdb: RxDatabase<ConnectionsCollections>;
  let collections: ConnectionsCollections;
  let finishSync: () => void;
  let pull: jasmine.Spy;
  let rpc: jasmine.Spy;
  let open: jasmine.Spy;
  /** What `get_connected_profiles()` returns. */
  let profiles: ConnectedProfile[];
  let stored: Map<string, unknown>;

  /** The local database as the sync leaves it, without the sync. */
  async function seed(rows: {
    connections?: ConnectionRow[];
    secrets?: SecretRow[];
    messages?: MessageRow[];
  }) {
    await collections.connections.bulkInsert(
      (rows.connections ?? []).map((row) => ({
        ...row,
        id: `${row.initiator_id}|${row.recipient_id}`,
      })),
    );
    await collections.secrets.bulkInsert(
      (rows.secrets ?? []).map((row) => ({ ...row, id: `${row.user_id}|${row.other_user_id}` })),
    );
    await collections.messages.bulkInsert(rows.messages ?? []);
  }

  function create(): ConnectionsStore {
    TestBed.configureTestingModule({
      providers: [
        ConnectionsStore,
        { provide: OPEN_CONNECTIONS_DB, useValue: open },
        { provide: SupabaseService, useValue: { client: { rpc } } },
        { provide: AuthService, useValue: { session: () => ({ user: { id: ME } }) } },
        {
          provide: PhotoStorageService,
          useValue: { signedUrls: async (refs: unknown[]) => refs.map(() => 'https://photo') },
        },
        {
          provide: UserStorage,
          useValue: {
            get: (key: string) => stored.get(key) ?? null,
            set: (key: string, value: unknown) => stored.set(key, value),
            remove: (key: string) => stored.delete(key),
          },
        },
        { provide: MatSnackBar, useValue: jasmine.createSpyObj('MatSnackBar', ['open']) },
      ],
    });
    return TestBed.inject(ConnectionsStore);
  }

  const profileLoads = () =>
    rpc.calls.allArgs().filter(([name]) => name === 'get_connected_profiles').length;
  const snackBar = () => TestBed.inject(MatSnackBar).open as jasmine.Spy;

  beforeEach(async () => {
    rxdb = await createRxDatabase<ConnectionsCollections>({
      name: `connections-store-spec-${databases++}`,
      storage: getRxStorageMemory(),
      multiInstance: false,
    });
    collections = await rxdb.addCollections(COLLECTIONS);
    const synced = new Promise<void>((resolve) => (finishSync = resolve));
    pull = jasmine.createSpy('pull');
    const db: ConnectionsDb = {
      collections,
      initialSync: () => synced,
      pull,
      // The test closes the database itself, after the store has gone.
      close: () => Promise.resolve(),
    };
    open = jasmine.createSpy('openConnectionsDb').and.resolveTo(db);
    profiles = [profile('ivy'), profile('kim'), profile('team', true)];
    rpc = jasmine
      .createSpy('rpc')
      .and.callFake(async (name: string) =>
        name === 'get_connected_profiles' ? { data: profiles, error: null } : { error: null },
      );
    stored = new Map();
    spyOn(console, 'warn');
  });

  afterEach(async () => {
    TestBed.resetTestingModule();
    await rxdb.close();
  });

  it('opens the signed-in user’s database', async () => {
    create();
    await until(() => open.calls.count() > 0, 'it opens');
    expect(open.calls.mostRecent().args[1]).toBe(ME);
  });

  it('isn’t ready until the first sync, so empty lists aren’t shown too early', async () => {
    const store = create();
    await settle();
    expect(store.ready()).toBeFalse();
    expect(store.introsLeftToday()).toBeNull();

    finishSync();
    await until(() => store.ready(), 'ready');
    expect(store.requests()).toEqual([]);
    expect(store.introsLeftToday()).toBe(3);
  });

  it('is ready without its own sync when another tab has synced the data', async () => {
    await seed({ connections: [connection({})] });
    const store = create();
    await until(() => store.ready(), 'ready');
    expect(store.conversationList().map(({ person }) => person.id)).toEqual(['ivy']);
  });

  it('builds the lists from the local data and the profiles', async () => {
    await seed({
      connections: [
        connection({ initiator_id: 'team', looking_for: [] }),
        connection({ initiator_id: 'ivy' }),
        connection({ initiator_id: 'kim', status: 'pending' }),
        connection({ initiator_id: ME, recipient_id: 'lea', status: 'pending' }),
      ],
      messages: [message('welcome', 'team', ME), message('intro', 'kim', ME)],
    });
    profiles.push(profile('lea'));
    const store = create();
    await until(() => store.ready(), 'ready');

    expect(store.team()?.person.id).toBe('team');
    expect(store.conversationList().map(({ person }) => person.id)).toEqual(
      jasmine.arrayWithExactContents(['team', 'ivy']),
    );
    // Only intros others sent, not the viewer's own.
    expect(store.requests().map(({ person }) => person.id)).toEqual(['kim']);
    expect(store.newRequests()).toBe(1);
    expect(store.totalUnread()).toBe(1);
  });

  it('asks for a missing profile once, even if the server doesn’t know them', async () => {
    // A connection with someone whose account is gone: get_connected_profiles() leaves them out.
    await seed({ connections: [connection({}), connection({ initiator_id: 'ghost' })] });
    const store = create();
    await until(() => store.ready(), 'ready');
    await settle();
    expect(profileLoads()).toBe(1);

    // Someone new does get a load.
    profiles.push(profile('lea'));
    await seed({ connections: [connection({ initiator_id: 'lea', status: 'pending' })] });
    await until(() => store.requests().length === 1, 'lea’s request shows');
    await settle();
    expect(profileLoads()).toBe(2);
  });

  it('hides a request at once, and declines it only when asked', async () => {
    await seed({
      connections: [connection({ initiator_id: 'kim', status: 'pending' })],
      messages: [message('intro', 'kim', ME)],
    });
    const store = create();
    await until(() => store.requests().length === 1, 'the request shows');
    const [request] = store.requests();

    store.setHidden('kim', true);
    expect(store.requests()).toEqual([]);
    store.setHidden('kim', false);
    expect(store.requests().length).toBe(1);
    expect(rpc).not.toHaveBeenCalledWith('decline_intro', jasmine.anything());

    store.setHidden('kim', true);
    await store.decline(request);
    expect(rpc).toHaveBeenCalledWith('decline_intro', { p_initiator_id: 'kim' });
    expect(pull).toHaveBeenCalled();
    expect(store.requests()).toEqual([]);
  });

  it('puts a request back when declining fails', async () => {
    await seed({ connections: [connection({ initiator_id: 'kim', status: 'pending' })] });
    rpc.and.callFake(async (name: string) =>
      name === 'get_connected_profiles'
        ? { data: profiles, error: null }
        : { error: { message: 'offline' } },
    );
    const store = create();
    await until(() => store.requests().length === 1, 'the request shows');
    const [request] = store.requests();

    store.setHidden('kim', true);
    await store.decline(request);

    expect(store.requests().length).toBe(1);
    expect(snackBar()).toHaveBeenCalledWith("Couldn't hide kim", undefined, jasmine.anything());
  });

  it('accepts an intro and waits until the accepted connection has synced', async () => {
    const pending = connection({ initiator_id: 'kim', status: 'pending' });
    await seed({ connections: [pending] });
    rpc.and.callFake(async (name: string) => {
      if (name === 'get_connected_profiles') return { data: profiles, error: null };
      // The sync bringing the server's change a moment later.
      setTimeout(async () => {
        const doc = await collections.connections.findOne(`kim|${ME}`).exec();
        await doc?.incrementalPatch({ status: 'accepted' });
      }, 20);
      return { error: null };
    });
    const store = create();
    await until(() => store.requests().length === 1, 'the request shows');

    expect(await store.accept(store.requests()[0])).toBeTrue();
    expect(rpc).toHaveBeenCalledWith('accept_intro', { p_initiator_id: 'kim' });
    expect(store.conversation('kim')?.status).toBe('accepted');
  });

  it('says so when accepting fails', async () => {
    await seed({ connections: [connection({ initiator_id: 'kim', status: 'pending' })] });
    rpc.and.callFake(async (name: string) =>
      name === 'get_connected_profiles'
        ? { data: profiles, error: null }
        : { error: { message: 'offline' } },
    );
    const store = create();
    await until(() => store.requests().length === 1, 'the request shows');

    expect(await store.accept(store.requests()[0])).toBeFalse();
    expect(snackBar()).toHaveBeenCalled();
    expect(store.conversation('kim')?.status).toBe('pending');
  });

  it('shows a sent message straight away, as sending until the server’s copy arrives', async () => {
    await seed({ connections: [connection({})] });
    const store = create();
    await until(() => store.ready(), 'ready');

    store.send('ivy', 'Hello!');
    await until(() => store.conversation('ivy')?.messages.length === 1, 'the message shows');
    const [sent] = store.conversation('ivy')!.messages;
    expect(sent.content).toEqual({ type: 'text', text: 'Hello!' });
    expect(sent.delivery).toBe('sending');

    // The pull brings the server's copy, which has an `updated_at`.
    const doc = await collections.messages.findOne(sent.id).exec();
    await doc?.incrementalPatch({ updated_at: new Date().toISOString() });
    await until(
      () => store.conversation('ivy')?.messages[0].delivery === undefined,
      'it shows as sent',
    );
  });

  it('marks a conversation read locally, for the sync to push', async () => {
    await seed({
      connections: [connection({})],
      secrets: [secret('ivy')],
      messages: [message('hi', 'ivy', ME)],
    });
    const store = create();
    await until(() => store.totalUnread() === 1, 'the message is unread');

    store.markRead('ivy');
    await until(() => store.totalUnread() === 0, 'it is read');
    const doc = await collections.secrets.findOne(`${ME}|ivy`).exec();
    expect(doc?.last_read_at).not.toBeNull();
  });

  it('counts the intros the viewer sent today', async () => {
    await seed({
      connections: [
        connection({ initiator_id: ME, recipient_id: 'ivy', status: 'pending' }),
        connection({ initiator_id: ME, recipient_id: 'kim', status: 'pending' }),
      ],
    });
    const store = create();
    await until(() => store.introsLeftToday() !== null, 'the count is known');
    expect(store.introsLeftToday()).toBe(1);
  });

  it('keeps a draft per conversation, and forgets an empty one', () => {
    const store = create();
    store.saveDraft('ivy', 'Half a thought');
    expect(store.draft('ivy')).toBe('Half a thought');
    expect(store.draft('kim')).toBe('');

    store.saveDraft('ivy', '  ');
    expect(store.draft('ivy')).toBe('');
  });
});
