-- Search: the profiles a member may see. The server applies only the rules about who may see
-- whom; the member's own filters are applied in the browser. See `search_profiles` in
-- docs/database.md.

-- A profile's `gender` as Gender filter values: the standard options as they are (copied from
-- GENDER_OPTIONS in onboarding-options.ts, like in set_search_filters(): keep them in step),
-- `self-described` for a value of their own, and `not-specified` for none.
create or replace function public.gender_filter_values(p_gender text[])
returns text[]
language sql
immutable
set search_path = public
as $$
  select case when cardinality(p_gender) = 0 then array['not-specified'] else array(
    select distinct case when g = any (array[
      'Non-binary', 'Man', 'Woman', 'Genderqueer', 'Genderfluid', 'Agender', 'Gender questioning'
    ]) then g else 'self-described' end
    from unnest(p_gender) g
  ) end;
$$;

-- The `active` members the caller may see in search, newest members first, as their profile
-- shows them: the age rather than the birth date, and no status, timestamps, search settings or
-- vetting answers (like get_connected_profiles(): keep the age rule in step with it and with
-- ageFrom() in the app). Leaves out:
-- - the caller, and anyone in another location (case-insensitive: it's free text);
-- - anyone with a connection with the caller, whatever its status (pending, accepted, ended),
--   and anyone the caller dismissed in search or whose intro they declined;
-- - with hide_by_gender, both ways: people who hide from the caller's gender, and, if the caller
--   hides by gender, people outside the caller's own Gender filter, so nobody can see people
--   who can't see them.
create or replace function public.search_profiles()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := public.require_auth_uid();
  me public.profiles;
begin
  select * into me from public.profiles where id = uid;
  if not found or me.status <> 'active' then
    raise exception 'Only members can search.' using errcode = 'insufficient_privilege';
  end if;

  return coalesce(
    (
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'pronouns', p.pronouns,
        'tagline', p.tagline,
        'bio', p.bio,
        'location', p.location,
        'gender', p.gender,
        'sexuality', p.sexuality,
        'looking_for', p.looking_for,
        'age', extract(
          year from age(now(), make_date(p.birth_year, p.birth_month, 1) + interval '1 month')
        )::int,
        'photos', p.photos
      ) order by p.age_verified_at desc, p.id)
      from public.profiles p
      where p.status = 'active'
        and p.id <> uid
        and lower(p.location) = lower(me.location)
        and not exists (
          select 1 from public.connections c
          where (c.initiator_id = uid and c.recipient_id = p.id)
             or (c.initiator_id = p.id and c.recipient_id = uid)
        )
        and not exists (
          select 1 from public.connection_secrets s
          where s.user_id = uid and s.other_user_id = p.id
            and (s.dismissed_at is not null or s.declined_at is not null)
        )
        and (not p.hide_by_gender
          or p.search_filters -> 'gender' ?| public.gender_filter_values(me.gender))
        and (not me.hide_by_gender
          or me.search_filters -> 'gender' ?| public.gender_filter_values(p.gender))
    ),
    '[]'
  );
end;
$$;

revoke execute on function public.gender_filter_values(text[]), public.search_profiles()
from public, anon, authenticated;
grant execute on function public.search_profiles() to authenticated;
