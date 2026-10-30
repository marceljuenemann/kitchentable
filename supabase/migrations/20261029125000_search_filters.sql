-- The member's search filters, saved so they survive signing out and work on any device, and
-- "Only show me to these genders". See `search_filters` and `hide_by_gender` in
-- docs/database.md.

alter table public.profiles
  -- Null until first saved, which means no filters. Shape (see set_search_filters()):
  -- {"looking_for": [...], "gender": [...], "min_age": n, "max_age": n,
  --  "show_unspecified_age": true|false}
  add column search_filters jsonb,
  -- Whether only members whose gender matches the Gender filter in search_filters can find this
  -- user in search, so nobody can hide from people they can see. Only ever true with a
  -- non-empty Gender filter.
  add column hide_by_gender boolean not null default false;

-- Saves the caller's search filters and the "Only show me to these genders" switch. The allowed
-- values are copied from the app: LOOKING_FOR_OPTIONS and GENDER_OPTIONS in
-- onboarding-options.ts, SELF_DESCRIBED, NOT_SPECIFIED, AGE_MIN and AGE_MAX in search.store.ts.
-- Keep them in step.
create or replace function public.set_search_filters(p_filters jsonb, p_hide_by_gender boolean)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid uuid := public.require_auth_uid();
begin
  if not coalesce(
    case when jsonb_typeof(p_filters) = 'object' then
      p_filters ?& array['looking_for', 'gender', 'min_age', 'max_age', 'show_unspecified_age']
      and p_filters - array['looking_for', 'gender', 'min_age', 'max_age', 'show_unspecified_age'] = '{}'
      and length(p_filters::text) <= 1000
      -- For arrays, <@ means every element is one of the allowed strings.
      and jsonb_typeof(p_filters -> 'looking_for') = 'array'
      and p_filters -> 'looking_for' <@ '["polyamory", "open-relationship", "relationship-anarchy",
        "friends", "exploring", "casual", "play-partners", "monogamy", "self-described"]'
      and jsonb_typeof(p_filters -> 'gender') = 'array'
      and p_filters -> 'gender' <@ '["Non-binary", "Man", "Woman", "Genderqueer", "Genderfluid",
        "Agender", "Gender questioning", "self-described", "not-specified"]'
      and p_filters ->> 'min_age' ~ '^\d{2}$'
      and p_filters ->> 'max_age' ~ '^\d{2}$'
      and (p_filters ->> 'min_age')::int between 18 and (p_filters ->> 'max_age')::int
      and (p_filters ->> 'max_age')::int <= 70
      and jsonb_typeof(p_filters -> 'show_unspecified_age') = 'boolean'
      and p_hide_by_gender is not null
    end,
    false
  ) then
    raise exception 'Invalid search filters.';
  end if;

  update public.profiles
  set search_filters = p_filters,
      hide_by_gender = p_hide_by_gender and jsonb_array_length(p_filters -> 'gender') > 0
  where id = uid;
  if not found then
    raise exception 'There is no profile.';
  end if;
end;
$$;

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

-- Whether "Only show me to these genders" hides this profile from someone of the given gender.
-- Used by search_profiles() and send_intro(), so a member can neither find nor reach someone who
-- hides from them.
create or replace function public.is_hidden_by_gender(
  p_profile public.profiles,
  p_viewer_gender text[]
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_profile.hide_by_gender
    and not coalesce(
      p_profile.search_filters -> 'gender' ?| public.gender_filter_values(p_viewer_gender),
      false
    );
$$;

revoke execute on function
  public.set_search_filters(jsonb, boolean),
  public.gender_filter_values(text[]),
  public.is_hidden_by_gender(public.profiles, text[])
from public, anon, authenticated;
grant execute on function public.set_search_filters(jsonb, boolean) to authenticated;
