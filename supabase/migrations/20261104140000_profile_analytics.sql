-- More analytics events. See "analytics_events" in docs/database.md.

-- The app's new events: sharing or copying the invite link, a photo turned down before upload,
-- and opening the profile preview. As before, plus those three.
create or replace function public.track_event(p_name text, p_props jsonb default null)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid uuid := public.require_auth_uid();
begin
  if p_name is null or p_name not in (
    'onboarding_step_viewed', 'invite_link_shared', 'photo_rejected', 'profile_preview_opened'
  ) then
    raise exception 'Unknown event.';
  end if;

  if p_props is not null and (jsonb_typeof(p_props) <> 'object' or length(p_props::text) > 500) then
    raise exception 'Event properties must be a small JSON object.';
  end if;

  insert into public.analytics_events (user_id, name, props) values (uid, p_name, p_props);
end;
$$;

-- `profile_changed`: which of a profile's fields changed (their names, never the values), and by
-- whom: `self` (the profile's owner), `admin`, or `system` (no signed-in user: the Didit webhook,
-- cron jobs, the service role, Studio). Recorded here rather than by the app, so every change
-- counts, and not through track_event(), so members can't record one themselves. The event's
-- user is the profile that changed.
create or replace function public.record_profile_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fields text[];
begin
  -- Every column, so new ones count too, except bookkeeping that changes without anyone editing
  -- anything: add any such column here.
  select array_agg(n.key order by n.key) into fields
  from jsonb_each(to_jsonb(new)) as n
  where n.key not in ('updated_at', 'intros_emailed_at', 'messages_emailed_at')
    and n.value is distinct from to_jsonb(old) -> n.key;

  if fields is not null then
    insert into public.analytics_events (user_id, name, props)
    values (new.id, 'profile_changed', jsonb_build_object(
      'fields', fields,
      'by', case
        when auth.uid() = new.id then 'self'
        when public.is_admin() then 'admin'
        else 'system'
      end
    ));
  end if;
  return null;
end;
$$;

revoke execute on function public.record_profile_change() from public, anon, authenticated;

create trigger profiles_record_change
  after update on public.profiles
  for each row execute function public.record_profile_change();
