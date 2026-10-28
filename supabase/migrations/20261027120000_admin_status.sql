-- Admin accounts are a profile status of their own, so an admin is never shown to members:
-- anything member-facing only shows `active` profiles. See docs/database.md.
--
-- In a migration of its own because Postgres can't use a new enum value in the transaction that
-- adds it, and the admin functions (next migration) do.

alter type public.profile_status add value 'admin';
