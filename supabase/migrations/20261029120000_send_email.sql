-- All emails now go through one edge function, send-email, which replaces notify-admin, and
-- approved applicants are emailed too. See "Emails" in docs/database.md.

-- The vault secrets were named after notify-admin. Rename them, and point the URL at the new
-- function, keeping their values, so environments set up by hand keep working. A fresh database
-- has neither (supabase/seed.sql creates them locally).
do $$
declare
  url_id uuid;
  url text;
  secret_id uuid;
begin
  select id, decrypted_secret into url_id, url from vault.decrypted_secrets where name = 'notify_admin_url';
  if url_id is not null then
    perform vault.update_secret(url_id, replace(url, '/functions/v1/notify-admin', '/functions/v1/send-email'), 'send_email_url');
  end if;
  select id into secret_id from vault.secrets where name = 'notify_admin_secret';
  if secret_id is not null then
    perform vault.update_secret(secret_id, new_name => 'send_email_secret');
  end if;
end;
$$;

-- Asks the send-email function to send one of its templates: to the admin, or to the given
-- user. pg_net sends the request after the transaction commits, so a rolled-back change emails
-- no one, and nothing is retried. Without the vault secrets, it warns and sends nothing.
create or replace function public.send_email(p_template text, p_user_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  url text;
  secret text;
begin
  select decrypted_secret into url from vault.decrypted_secrets where name = 'send_email_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'send_email_secret';
  if url is null or secret is null then
    raise warning 'send_email_url or send_email_secret is missing from the vault, so the % email is not sent.', p_template;
    return;
  end if;

  perform net.http_post(
    url := url,
    body := jsonb_strip_nulls(jsonb_build_object('template', p_template, 'user_id', p_user_id)),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-send-email-secret', secret)
  );
end;
$$;

revoke execute on function public.send_email(text, uuid) from public, anon, authenticated;

-- The trigger from 20261001130000_notify_admin.sql, now through send_email().
create or replace function public.notify_admin_of_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.send_email('application_submitted');
  return null;
end;
$$;

-- Tells an applicant they've been approved, and that the age check is next. A trigger rather
-- than part of admin_approve_application, so approving by hand in Studio emails them too.
create or replace function public.notify_member_of_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.send_email('application_approved', new.id);
  return null;
end;
$$;

revoke execute on function public.notify_member_of_approval() from public, anon, authenticated;

create trigger notify_member_of_approval
  after update of status on public.profiles
  for each row
  when (old.status = 'vetting' and new.status = 'approved')
  execute function public.notify_member_of_approval();
