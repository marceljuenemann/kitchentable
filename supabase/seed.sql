-- Local development and CI only (runs on `supabase db reset`). Staging sets its own values by
-- hand, see README.md.

-- For the notify_admin_of_application trigger: the local notify-admin edge function, reached
-- through the API gateway on the Docker network. The secret matches supabase/functions/.env.
select vault.create_secret('http://kong:8000/functions/v1/notify-admin', 'notify_admin_url');
select vault.create_secret('local-notify-admin-secret', 'notify_admin_secret');
