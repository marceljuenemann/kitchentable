-- "Only show me to these genders" in search: the genders whose members may find the user. Saved
-- from the app for now; search_profiles() will apply it. See `visible_to_genders` in
-- docs/database.md.

-- Null: anyone. Otherwise the user's own Gender filter values: standard options (copied from
-- GENDER_OPTIONS in onboarding-options.ts, keep the two in step), `self-described` and
-- `not-specified`. Never empty: that's stored as null.
alter table public.profiles
  add column visible_to_genders text[]
  check (cardinality(visible_to_genders) > 0);

-- Saves the caller's Gender filter while the switch is on, or null (or an empty array) when it's
-- off. Stored without duplicates, in a fixed order, since only membership matters.
create or replace function public.set_visible_to_genders(p_genders text[])
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid uuid := public.require_auth_uid();
begin
  if not p_genders <@ array[
    'Non-binary', 'Man', 'Woman', 'Genderqueer', 'Genderfluid', 'Agender', 'Gender questioning',
    'self-described', 'not-specified'
  ] then
    raise exception 'Unknown gender filter value.';
  end if;

  update public.profiles
  set visible_to_genders = (select array_agg(distinct g order by g) from unnest(p_genders) g)
  where id = uid;
  if not found then
    raise exception 'There is no profile.';
  end if;
end;
$$;

revoke execute on function public.set_visible_to_genders(text[]) from public, anon, authenticated;
grant execute on function public.set_visible_to_genders(text[]) to authenticated;
