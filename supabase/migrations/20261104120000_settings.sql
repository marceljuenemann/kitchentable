-- The member's settings, in the app's Settings sheet: for now, whether to get the emails about
-- new intros and about new messages. See `intro_emails`, `message_emails` and `update_settings`
-- in docs/database.md.

alter table public.profiles
  add column intro_emails boolean not null default true,
  add column message_emails boolean not null default true;

-- Saves the caller's settings, the whole set at once.
create or replace function public.update_settings(p_intro_emails boolean, p_message_emails boolean)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid uuid := public.require_auth_uid();
begin
  if p_intro_emails is null or p_message_emails is null then
    raise exception 'Invalid settings.';
  end if;

  update public.profiles
  set intro_emails = p_intro_emails,
      message_emails = p_message_emails
  where id = uid;
  if not found then
    raise exception 'There is no profile.';
  end if;
end;
$$;

revoke execute on function public.update_settings(boolean, boolean) from public, anon, authenticated;
grant execute on function public.update_settings(boolean, boolean) to authenticated;
