-- First-party product analytics: events that leave no other trace in the database (say, how far
-- someone got in onboarding, whose draft lives in the browser until submitted). See
-- docs/database.md for what may and may not be recorded.

create extension if not exists pg_cron with schema pg_catalog;

create table public.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  props jsonb,
  created_at timestamptz not null default now()
);

create index analytics_events_name_created_at on public.analytics_events (name, created_at);

-- No client access at all, like profiles: events are only written through track_event() and
-- only read with the service role (Studio).
alter table public.analytics_events enable row level security;
revoke all on public.analytics_events from anon, authenticated;
revoke all on sequence public.analytics_events_id_seq from anon, authenticated;
grant all on public.analytics_events to service_role;

-- Records an event for the caller. Every event name is listed here, so adding one goes through a
-- migration and gets reviewed.
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
  if p_name is null or p_name not in ('onboarding_step_viewed') then
    raise exception 'Unknown event.';
  end if;

  if p_props is not null and (jsonb_typeof(p_props) <> 'object' or length(p_props::text) > 500) then
    raise exception 'Event properties must be a small JSON object.';
  end if;

  insert into public.analytics_events (user_id, name, props) values (uid, p_name, p_props);
end;
$$;

revoke execute on function public.track_event(text, jsonb) from public, anon, authenticated;
grant execute on function public.track_event(text, jsonb) to authenticated;

-- Events are kept for 3 months (and go with the account when it is deleted).
select cron.schedule(
  'purge-analytics-events',
  '0 3 * * *',
  $$delete from public.analytics_events where created_at < now() - interval '3 months'$$
);
