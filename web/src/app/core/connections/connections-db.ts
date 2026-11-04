import type { PostgrestError, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import {
  createRxDatabase,
  removeRxDatabase,
  ReplicationPullOptions,
  RxCollection,
  RxJsonSchema,
  WithDeleted,
} from 'rxdb';
import { replicateRxCollection } from 'rxdb/plugins/replication';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { Subject } from 'rxjs';
import { ConnectionRow, MessageRow, SecretRow } from './connections.model';

/**
 * The local copy of the user's connections, connection_secrets and messages, which the app reads
 * instead of the server so that it works on spotty connections (see "Messaging sync" in
 * docs/database.md). In the signed-in chunk with the rest of the main app; keep it out of the
 * initial bundle (sign-out, which the landing page has too, imports it dynamically).
 */

const BATCH_SIZE = 100;
/**
 * How far behind the newest row a sync's last checkpoint stays. `updated_at` is when a
 * transaction started, not when it committed, so a row can become visible after a pull has
 * already moved past its timestamp. Re-reading the last few seconds catches it, as long as no
 * transaction takes this long to commit (ours take milliseconds).
 */
export const CHECKPOINT_LAG_MS = 5000;
/** Realtime events come in bursts (an intro is a connection, a message and two secrets). */
const NUDGE_DELAY_MS = 100;

/** Where a pull got to: the last row's `updated_at` and key columns, in key order. */
export interface Checkpoint {
  updated_at: string;
  keys: string[];
}

type Row = { updated_at: string } & Record<string, unknown>;

/** RxDB keeps a composite primary key as a field of its own. */
export type ConnectionDoc = ConnectionRow & { id: string };
export type SecretDoc = SecretRow & { id: string };

export interface ConnectionsCollections {
  connections: RxCollection<ConnectionDoc>;
  secrets: RxCollection<SecretDoc>;
  messages: RxCollection<MessageRow>;
}

export interface ConnectionsDb {
  collections: ConnectionsCollections;
  /** Resolves once each collection has been in sync with the server, if this tab syncs. */
  initialSync(): Promise<void>;
  /** Pulls soon, if this tab is the one that syncs; another tab's sync reaches it anyway. */
  pull(): void;
  close(): Promise<void>;
}

function databaseName(userId: string): string {
  return `kt-${userId}`;
}

const nullableString = { type: ['string', 'null'] };

const connectionSchema: RxJsonSchema<ConnectionDoc> = {
  version: 0,
  primaryKey: { key: 'id', fields: ['initiator_id', 'recipient_id'], separator: '|' },
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 80 },
    initiator_id: { type: 'string', maxLength: 36 },
    recipient_id: { type: 'string', maxLength: 36 },
    status: { type: 'string' },
    looking_for: { type: 'array', items: { type: 'string' } },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
  },
  required: ['id', 'initiator_id', 'recipient_id', 'status', 'looking_for', 'created_at'],
};

const secretSchema: RxJsonSchema<SecretDoc> = {
  version: 0,
  primaryKey: { key: 'id', fields: ['user_id', 'other_user_id'], separator: '|' },
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 80 },
    user_id: { type: 'string', maxLength: 36 },
    other_user_id: { type: 'string', maxLength: 36 },
    dismissed_at: nullableString,
    declined_at: nullableString,
    last_read_at: nullableString,
    updated_at: { type: 'string' },
  },
  required: ['id', 'user_id', 'other_user_id'],
};

const messageSchema: RxJsonSchema<MessageRow> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 36 },
    sender_id: { type: 'string' },
    recipient_id: { type: 'string' },
    content: { type: 'object' },
    created_at: { type: 'string' },
    // Only once the server has the message: one waiting to be sent has none.
    updated_at: { type: 'string' },
    // Only on this device: the server refused the message.
    failed: { type: 'boolean' },
  },
  required: ['id', 'sender_id', 'recipient_id', 'content', 'created_at'],
};

/** The collections, for `addCollections()` (also in the store's tests, without sync). */
export const COLLECTIONS = {
  connections: { schema: connectionSchema },
  secrets: { schema: secretSchema },
  messages: { schema: messageSchema },
};

/**
 * The PostgREST filter for the rows after a checkpoint, by `(updated_at, ...keyColumns)`:
 * a later `updated_at`, or the same one and later keys.
 */
export function afterCheckpoint({ updated_at, keys }: Checkpoint, keyColumns: string[]): string {
  const time = `"${updated_at}"`;
  const branches = [`updated_at.gt.${time}`];
  keyColumns.forEach((column, index) => {
    const equal = keyColumns.slice(0, index).map((before, i) => `${before}.eq.${keys[i]}`);
    branches.push(`and(${[`updated_at.eq.${time}`, ...equal, `${column}.gt.${keys[index]}`]})`);
  });
  return branches.join(',');
}

/**
 * The checkpoint to return for a batch of rows, in pull order. A full batch moves on to its last
 * row, since there's more to fetch. At the end of a sync it stops at the last row at least
 * `CHECKPOINT_LAG_MS` older than the newest one, so the next pull reads the rows after it again.
 * Measured from the newest row rather than the device's clock, so a wrong clock can't skip any.
 */
export function nextCheckpoint(
  rows: Row[],
  keyColumns: string[],
  batchSize: number,
  previous: Checkpoint | undefined,
): Checkpoint | undefined {
  const last = rows.at(-1);
  if (!last) return previous;
  const toCheckpoint = (row: Row): Checkpoint => ({
    updated_at: row.updated_at,
    keys: keyColumns.map((column) => String(row[column])),
  });
  if (rows.length === batchSize) return toCheckpoint(last);
  const settled = Date.parse(last.updated_at) - CHECKPOINT_LAG_MS;
  const safe = [...rows].reverse().find((row) => Date.parse(row.updated_at) <= settled);
  return safe ? toCheckpoint(safe) : previous;
}

/**
 * Whether the database refused a write, as opposed to it not getting there. A refusal has a
 * SQLSTATE (ours raise `P0001`, `54000` and so on), and sending it again won't help. Errors from
 * PostgREST itself (`PGRST…`, such as an expired token), from the network (no code) or of the
 * passing kind (connection, rollback, resources, timeouts) are worth retrying.
 */
export function isRefusal(error: Pick<PostgrestError, 'code'>): boolean {
  const code = error.code ?? '';
  return /^[0-9A-Z]{5}$/.test(code) && !/^(08|40|53|57|58)/.test(code);
}

/** The database open in this tab, so that signing out can close it before removing it. */
let open: ConnectionsDb | null = null;

/**
 * Opens the user's local database and starts syncing it with the server, closing any other this
 * tab has open.
 */
export async function openConnectionsDb(
  supabase: SupabaseClient,
  userId: string,
): Promise<ConnectionsDb> {
  await open?.close();

  const db = await createRxDatabase<ConnectionsCollections>({
    name: databaseName(userId),
    storage: getRxStorageDexie(),
    closeDuplicates: true,
  });
  const collections = await db.addCollections(COLLECTIONS);

  // Realtime only says when to pull: the pull is the only source of data, so a missed event just
  // waits for the next one.
  const nudges$ = new Subject<'RESYNC'>();
  let nudgeTimer: ReturnType<typeof setTimeout> | undefined;
  const nudge = () => {
    clearTimeout(nudgeTimer);
    nudgeTimer = setTimeout(() => nudges$.next('RESYNC'), NUDGE_DELAY_MS);
  };

  function pullFrom<T>(table: string, keyColumns: string[]): ReplicationPullOptions<T, Checkpoint> {
    return {
      batchSize: BATCH_SIZE,
      async handler(checkpoint, batchSize) {
        let query = supabase.from(table).select('*');
        // RxDB stores "no checkpoint yet" as `{}`.
        if (checkpoint?.updated_at) query = query.or(afterCheckpoint(checkpoint, keyColumns));
        query = query.order('updated_at');
        for (const column of keyColumns) query = query.order(column);
        const { data, error } = await query.limit(batchSize);
        if (error) throw error;
        const rows = data as Row[];
        return {
          documents: rows as unknown as WithDeleted<T>[],
          checkpoint: nextCheckpoint(rows, keyColumns, batchSize, checkpoint),
        };
      },
      stream$: nudges$,
    };
  }

  const replications = [
    replicateRxCollection<ConnectionDoc, Checkpoint>({
      replicationIdentifier: 'supabase-connections',
      collection: collections.connections,
      pull: pullFrom('connections', ['initiator_id', 'recipient_id']),
    }),
    replicateRxCollection<SecretDoc, Checkpoint>({
      replicationIdentifier: 'supabase-connection_secrets',
      collection: collections.secrets,
      pull: pullFrom('connection_secrets', ['user_id', 'other_user_id']),
      push: {
        // Only the read watermark is written locally (dismissing someone is search's, directly).
        async handler(rows) {
          const conflicts: WithDeleted<SecretDoc>[] = [];
          for (const { newDocumentState: doc, assumedMasterState: master } of rows) {
            if (!doc.last_read_at || doc.last_read_at === master?.last_read_at) continue;
            const { error } = await supabase.rpc('mark_read', {
              p_user_id: doc.other_user_id,
              p_read_at: doc.last_read_at,
            });
            if (!error) continue;
            if (!isRefusal(error)) throw error;
            console.warn('Marking as read was refused', error);
            // Keeps the server's state, dropping the local change.
            if (master) conflicts.push(master);
          }
          nudge();
          return conflicts;
        },
      },
    }),
    replicateRxCollection<MessageRow, Checkpoint>({
      replicationIdentifier: 'supabase-messages',
      collection: collections.messages,
      deletedField: 'deleted',
      pull: pullFrom('messages', ['id']),
      push: {
        // One at a time, so they arrive in the order they were written.
        async handler(rows) {
          const conflicts: WithDeleted<MessageRow>[] = [];
          for (const { newDocumentState: doc } of rows) {
            if (doc.failed || doc.updated_at) continue;
            const { error } = await supabase.rpc('send_message', {
              p_id: doc.id,
              p_recipient_id: doc.recipient_id,
              p_content: doc.content,
            });
            if (!error) continue;
            if (!isRefusal(error)) throw error;
            console.warn('A message was refused', error);
            // Taken as the server's state, so it isn't sent again and later ones aren't held up.
            conflicts.push({ ...doc, failed: true });
          }
          // Brings the server's copies, which show the messages as sent.
          nudge();
          return conflicts;
        },
      },
    }),
  ];
  // RxDB retries failed pulls and pushes by itself, and only reports the errors here.
  for (const replication of replications) {
    replication.error$.subscribe((error) => console.warn('Sync failed, retrying', error));
  }

  // Only the tab that syncs listens, from when it becomes that tab until the database closes.
  let channel: RealtimeChannel | undefined;
  let closed = false;
  void db.waitForLeadership().then(() => {
    if (closed) return;
    channel = supabase.channel(`sync-${userId}`);
    for (const table of ['connections', 'connection_secrets', 'messages']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, nudge);
    }
    // Also after reconnecting, to catch up on what happened meanwhile.
    channel.subscribe((status) => status === 'SUBSCRIBED' && nudge());
  });

  const connectionsDb: ConnectionsDb = {
    collections,
    async initialSync() {
      await Promise.all(replications.map((replication) => replication.awaitInitialReplication()));
    },
    pull: nudge,
    async close() {
      if (closed) return;
      closed = true;
      if (open === connectionsDb) open = null;
      clearTimeout(nudgeTimer);
      if (channel) await supabase.removeChannel(channel);
      await Promise.all(replications.map((replication) => replication.cancel()));
      await db.close();
    },
  };
  open = connectionsDb;
  return connectionsDb;
}

/** Deletes the user's local data, for signing out. */
export async function removeConnectionsDb(userId: string): Promise<void> {
  await open?.close();
  await removeRxDatabase(databaseName(userId), getRxStorageDexie());
  // The Dexie storage only empties its IndexedDB databases (one per collection), so delete them
  // too: not even the user's id in their names stays behind.
  const prefix = `rxdb-dexie-${databaseName(userId)}--`;
  const names = (await indexedDB.databases())
    .map(({ name }) => name)
    .filter((name) => name?.startsWith(prefix));
  await Promise.all(
    names.map(
      (name) =>
        new Promise((resolve, reject) => {
          const request = indexedDB.deleteDatabase(name!);
          request.onsuccess = resolve;
          request.onerror = () => reject(request.error);
        }),
    ),
  );
}
