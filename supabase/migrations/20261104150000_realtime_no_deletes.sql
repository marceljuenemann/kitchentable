-- Realtime applies select policies to inserts and updates only: it sends every delete to every
-- subscriber, with the deleted row's primary key. For connections and connection_secrets that
-- key is who contacted (or hid) whom, and deleting an account cascades to all of that person's
-- rows. The app doesn't need deletes (an event only tells it to pull, and the pull never sees
-- hard deletes), so the publication leaves them out, and truncates too. This applies to every
-- table in it, which are only the three the app syncs.
alter publication supabase_realtime set (publish = 'insert, update');
