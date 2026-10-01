-- Emails the admin when an application comes in, through the notify-admin edge function. See
-- docs/database.md.
--
-- The function's URL and shared secret differ per environment, so they live in the vault rather
-- than here: `notify_admin_url` and `notify_admin_secret` (supabase/seed.sql locally, set by hand
-- on staging, see README.md).

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_admin_of_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  url text;
  secret text;
begin
  select decrypted_secret into url from vault.decrypted_secrets where name = 'notify_admin_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'notify_admin_secret';
  if url is null or secret is null then
    raise warning 'notify_admin_url or notify_admin_secret is missing from the vault, so the admin is not notified.';
    return null;
  end if;

  -- No body: the email carries no personal data, so the function needs none. pg_net sends the
  -- request after the transaction commits, so a failed submission notifies no one.
  perform net.http_post(
    url := url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-admin-secret', secret)
  );
  return null;
end;
$$;

revoke execute on function public.notify_admin_of_application() from public, anon, authenticated;

create trigger notify_admin_of_application
  after insert on public.profiles
  for each row
  when (new.status = 'vetting')
  execute function public.notify_admin_of_application();
