-- Local development and CI only (runs on `supabase db reset`). Staging sets its own values by
-- hand, see README.md.

-- For send_email(): the local send-email edge function, reached through the API gateway on the
-- Docker network. The secret matches supabase/functions/.env.
select vault.create_secret('http://kong:8000/functions/v1/send-email', 'send_email_url');
select vault.create_secret('local-send-email-secret', 'send_email_secret');
