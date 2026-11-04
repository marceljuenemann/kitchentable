import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  InjectionToken,
  signal,
  untracked,
} from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import type { RxCollection } from 'rxdb';
import { filter, firstValueFrom, map, of, timeout } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { PhotoStorageService } from '../photo-storage.service';
import { Member } from '../profile.model';
import { SupabaseService } from '../supabase.service';
import { UserStorage } from '../user-storage';
import { ConnectionsDb, openConnectionsDb } from './connections-db';
import {
  ConnectedProfile,
  ConnectionRow,
  Conversation,
  INTROS_PER_DAY,
  introsSentToday,
  lastMessage,
  MessageRow,
  SecretRow,
  toConversations,
  unreadCount,
} from './connections.model';

/** Well within the hour that signed photo URLs last, so avatars shown again still load. */
const RELOAD_AFTER_MS = 30 * 60 * 1000;
/**
 * How long a change made through the server (accepting, ending) may take to come back through the
 * sync before the app carries on anyway. Usually it's well under a second.
 */
const SYNC_WAIT_MS = 10_000;

/** The error `send_intro` raises for the 4th intro of the day. */
export const INTRO_LIMIT_CODE = '54000';

/** Opens the user's local database. A token so that tests can give the store one without sync. */
export const OPEN_CONNECTIONS_DB = new InjectionToken<typeof openConnectionsDb>(
  'OPEN_CONNECTIONS_DB',
  { providedIn: 'root', factory: () => openConnectionsDb },
);

/** Each conversation's unsent text, under its own key in UserStorage. */
function draftKey(id: string): string {
  return `messages.draft.${id}`;
}

function newestFirst(a: Conversation, b: Conversation): number {
  return (lastMessage(b)?.createdAt ?? '').localeCompare(lastMessage(a)?.createdAt ?? '');
}

/**
 * The viewer's connections and conversations, from the local database that syncs them (see
 * connections-db.ts and "Messaging sync" in docs/database.md), with the profiles of the people
 * in them. Messages and read state are written locally and synced; intros, accepting, declining
 * and ending go straight to the server, so the user hears at once if they fail. Provided by the
 * main app, because the bottom nav shows the counts: unlike the rest of `core/`, it isn't
 * app-wide.
 */
@Injectable()
export class ConnectionsStore {
  private readonly supabase = inject(SupabaseService);
  private readonly photos = inject(PhotoStorageService);
  private readonly storage = inject(UserStorage);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly openDb = inject(OPEN_CONNECTIONS_DB);
  /** The main app only shows once signed in. */
  private readonly me = inject(AuthService).session()?.user.id ?? '';

  private db: ConnectionsDb | null = null;
  private destroyed = false;
  private readonly connectionRows = signal<ConnectionRow[]>([]);
  private readonly secretRows = signal<SecretRow[]>([]);
  private readonly messageRows = signal<MessageRow[]>([]);
  private readonly profiles = signal<ReadonlyMap<string, ConnectedProfile>>(new Map());
  /** Main photo thumbnails by person. */
  private readonly photoUrls = signal<ReadonlyMap<string, string | null>>(new Map());
  private profilesLoadedAt = 0;
  private loadingProfiles = false;
  /** The people a profile load was started for, so each missing one is only asked about once. */
  private readonly profilesAskedFor = new Set<string>();
  /** Whether the local data is there: synced once, or already synced by another tab. */
  private readonly synced = signal(false);
  private readonly profilesTried = signal(false);
  /** Requests hidden while their Undo snackbar shows, and until the decline has synced. */
  private readonly hiddenRequests = signal<ReadonlySet<string>>(new Set());

  /** Whether there's something to show: until then, empty lists aren't really empty. */
  readonly ready = computed(() => this.synced() && this.profilesTried());

  private readonly conversations = computed(() =>
    toConversations(
      this.me,
      this.connectionRows(),
      this.secretRows(),
      this.messageRows(),
      this.profiles(),
      this.photoUrls(),
    ),
  );
  private readonly conversations$ = toObservable(this.conversations);

  /** The conversation with the admins. */
  readonly team = computed(() => this.conversations().find(({ isTeam }) => isTeam));
  /** Accepted and ended ones. A pending intro only joins them once it's accepted. */
  readonly conversationList = computed(() =>
    this.conversations()
      .filter(({ status }) => status !== 'pending')
      .sort(newestFirst),
  );
  /** Intros others sent the viewer, for the Connections tab. */
  readonly requests = computed(() => {
    const hidden = this.hiddenRequests();
    return this.conversations()
      .filter(
        ({ status, initiatedByMe, declined, person }) =>
          status === 'pending' && !initiatedByMe && !declined && !hidden.has(person.id),
      )
      .sort(newestFirst);
  });
  /** The requests that have arrived since the viewer last opened the Connections tab. */
  readonly newRequests = computed(
    () => this.requests().filter(({ lastReadAt }) => lastReadAt === null).length,
  );
  readonly totalUnread = computed(() =>
    this.conversations()
      .filter(({ status }) => status !== 'pending')
      .reduce((total, conversation) => total + unreadCount(conversation), 0),
  );
  /** Introductions the viewer can still send today. Null until the local data is there. */
  readonly introsLeftToday = computed(() =>
    this.synced()
      ? Math.max(0, INTROS_PER_DAY - introsSentToday(this.me, this.connectionRows(), new Date()))
      : null,
  );

  constructor() {
    // A connection with someone whose profile hasn't loaded, such as a new intro. Only once per
    // person: someone the server doesn't return (a local row whose account was deleted outright)
    // would otherwise reload the profiles for ever.
    effect(() => {
      const profiles = this.profiles();
      const missing = this.connectionRows()
        .map(({ initiator_id, recipient_id }) =>
          initiator_id === this.me ? recipient_id : initiator_id,
        )
        .filter((id) => !profiles.has(id) && !this.profilesAskedFor.has(id));
      if (missing.length > 0) untracked(() => void this.loadProfiles(missing));
    });
    // Nothing to load for someone without connections.
    effect(() => {
      if (this.synced() && this.connectionRows().length === 0) this.profilesTried.set(true);
    });

    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      void this.db?.close();
    });
    void this.open();
  }

  conversation(id: string | null): Conversation | undefined {
    return this.conversations().find(({ person }) => person.id === id);
  }

  /** Signs the photos again when a tab opens, unless that was only a little while ago. */
  loadIfStale() {
    if (Date.now() - this.profilesLoadedAt > RELOAD_AFTER_MS) void this.loadProfiles();
  }

  markRead(id: string) {
    const readAt = new Date().toISOString();
    void this.db?.collections.secrets
      .findOne(`${this.me}|${id}`)
      .exec()
      .then((secret) => secret?.incrementalPatch({ last_read_at: readAt }))
      .catch((error) => console.warn('Could not mark as read', error));
  }

  /** Opening the Connections tab counts as having seen every request in it. */
  markRequestsSeen() {
    this.requests()
      .filter(({ lastReadAt }) => lastReadAt === null)
      .forEach(({ person }) => this.markRead(person.id));
  }

  /**
   * Sends an intro (`send_intro`), online only, so a refusal shows straight away. Throws on
   * failure; the daily limit has the code `INTRO_LIMIT_CODE`.
   */
  async sendIntro(member: Member, lookingFor: string[], text: string): Promise<void> {
    const { error } = await this.supabase.client.rpc('send_intro', {
      p_recipient_id: member.id,
      p_looking_for: lookingFor,
      p_content: { type: 'text', text },
    });
    // Either way: the new connection counts towards today's, and so may ones from other devices.
    this.db?.pull();
    if (error) throw error;
  }

  /** Accepts an intro, and waits for the connection to sync. Says so if it fails. */
  async accept({ person }: Conversation): Promise<boolean> {
    const { error } = await this.supabase.client.rpc('accept_intro', {
      p_initiator_id: person.id,
    });
    if (error) {
      console.warn('Could not accept the intro', error);
      this.notify(`Couldn't connect with ${person.name}. Check your connection and try again.`);
      return false;
    }
    await this.syncUntil(() => this.conversation(person.id)?.status === 'accepted');
    return true;
  }

  /** Takes a request off the list straight away, or puts it back (for the Undo snackbar). */
  setHidden(id: string, hidden: boolean) {
    this.hiddenRequests.update((ids) => {
      const next = new Set(ids);
      if (hidden) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  /** Declines a hidden request for good. A failure puts it back. */
  async decline({ person }: Conversation) {
    const { error } = await this.supabase.client.rpc('decline_intro', {
      p_initiator_id: person.id,
    });
    if (error) {
      console.warn('Could not decline the intro', error);
      this.setHidden(person.id, false);
      this.notify(`Couldn't hide ${person.name}`);
      return;
    }
    this.db?.pull();
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

  /** Shows the message straight away; the sync sends it, whenever there's a connection. */
  send(id: string, text: string) {
    const message: MessageRow = {
      id: crypto.randomUUID(),
      sender_id: this.me,
      recipient_id: id,
      content: { type: 'text', text },
      created_at: new Date().toISOString(),
    };
    void this.db?.collections.messages
      .insert(message)
      .catch((error) => console.warn('Could not save the message', error));
  }

  /** Ends a connection for good, and waits for it to sync. Says so if it fails. */
  async end(id: string) {
    const { error } = await this.supabase.client.rpc('end_connection', { p_user_id: id });
    if (error) {
      console.warn('Could not end the connection', error);
      this.notify("Couldn't end the connection. Check your connection and try again.");
      return;
    }
    this.saveDraft(id, '');
    await this.syncUntil(() => this.conversation(id)?.status === 'ended');
  }

  private async open() {
    if (!this.me) return;
    try {
      const db = await this.openDb(this.supabase.client, this.me);
      if (this.destroyed) {
        await db.close();
        return;
      }
      this.db = db;
      const { connections, secrets, messages } = db.collections;
      this.follow(connections, (rows) => {
        this.connectionRows.set(rows);
        // Only the tab that syncs gets to the end of a first sync; the others' data is there.
        if (rows.length > 0) this.synced.set(true);
      });
      this.follow(secrets, (rows) => this.secretRows.set(rows));
      this.follow(messages, (rows) => this.messageRows.set(rows));
      void db.initialSync().then(() => this.synced.set(true));
    } catch (error) {
      console.error('Could not open the local database', error);
    }
  }

  /** Calls back with everything in a collection, now and after every change. */
  private follow<T>(collection: RxCollection<T>, next: (rows: T[]) => void) {
    const subscription = collection
      .find()
      .$.pipe(map((docs) => docs.map((doc) => doc.toMutableJSON() as T)))
      .subscribe(next);
    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }

  /**
   * Profiles from `get_connected_profiles()` and their main thumbnails, which show together. Kept
   * in memory: the app needs the server to start anyway (see "Messaging sync").
   */
  private async loadProfiles(missing: string[] = []) {
    if (this.loadingProfiles) return;
    this.loadingProfiles = true;
    missing.forEach((id) => this.profilesAskedFor.add(id));
    try {
      const { data, error } = await this.supabase.client.rpc('get_connected_profiles');
      if (error) throw error;
      const profiles = data as ConnectedProfile[];
      // The team's avatar is the logo.
      const withPhoto = profiles.filter(({ photos, is_admin }) => photos.length > 0 && !is_admin);
      const urls = await this.photos.signedUrls(
        withPhoto.map(({ id, photos }) => ({ ownerId: id, photoId: photos[0] })),
        'thumb',
      );
      this.photoUrls.set(new Map(withPhoto.map(({ id }, index) => [id, urls[index]])));
      this.profiles.set(new Map(profiles.map((profile) => [profile.id, profile])));
      this.profilesLoadedAt = Date.now();
    } catch (error) {
      console.warn('Could not load the profiles of connections', error);
      // So that the next change tries again.
      missing.forEach((id) => this.profilesAskedFor.delete(id));
    } finally {
      this.loadingProfiles = false;
      this.profilesTried.set(true);
    }
  }

  /** Pulls, and waits until the local data shows a change made on the server (or gives up). */
  private async syncUntil(done: () => boolean) {
    this.db?.pull();
    await firstValueFrom(
      this.conversations$.pipe(
        filter(() => done()),
        timeout({ first: SYNC_WAIT_MS, with: () => of(null) }),
      ),
    );
  }

  private notify(message: string) {
    this.snackBar.open(message, undefined, { duration: 6000, panelClass: 'kt-snackbar' });
  }
}
