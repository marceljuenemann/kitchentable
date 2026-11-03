begin;
select plan(1);

-- The app's sync pulls when Realtime reports a change to one of these (see "Messaging sync" in
-- docs/database.md).
select set_eq(
  $$ select tablename::text from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' $$,
  array['connections', 'connection_secrets', 'messages'],
  'connections, connection_secrets and messages are published to Realtime'
);

select * from finish();
rollback;
