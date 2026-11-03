-- Realtime for the tables the app syncs into RxDB. A change only tells the app to pull (the pull
-- is the only source of data), and Realtime applies each table's select policy to every
-- subscriber, so nobody hears about rows they can't read. See "Messaging sync" in
-- docs/database.md.
alter publication supabase_realtime
  add table public.connections, public.connection_secrets, public.messages;
