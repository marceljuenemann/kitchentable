begin;
select plan(2);

-- The app's sync pulls when Realtime reports a change to one of these (see "Messaging sync" in
-- docs/database.md).
select set_eq(
  $$ select tablename::text from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' $$,
  array['connections', 'connection_secrets', 'messages'],
  'connections, connection_secrets and messages are published to Realtime'
);

-- Realtime sends deletes to every subscriber regardless of RLS, with the row's primary key, which
-- for connections is who contacted whom.
select results_eq(
  $$ select pubinsert, pubupdate, pubdelete, pubtruncate from pg_publication
     where pubname = 'supabase_realtime' $$,
  $$ values (true, true, false, false) $$,
  'Realtime publishes inserts and updates, not deletes or truncates'
);

select * from finish();
rollback;
