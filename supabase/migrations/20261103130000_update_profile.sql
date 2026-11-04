-- Editing your profile after onboarding (the profile tab). See docs/database.md.

-- What makes a profile's own fields valid, for submit_onboarding() and update_profile() alike, so
-- the two can't drift apart. Not the UI's own minimums (say, the 250 characters asked of the
-- bio): those are product copy and change more often than the schema. Location is checked by
-- submit_onboarding() only, since it can't be edited.
create or replace function public.check_profile_fields(
  p_name text,
  p_pronouns text,
  p_tagline text,
  p_bio text,
  p_birth_year int,
  p_birth_month int,
  p_looking_for text[],
  p_photos uuid[]
)
returns void
language plpgsql
stable
set search_path = public
as $$
declare
  age int;
begin
  if coalesce(trim(p_name), '') = ''
    or coalesce(trim(p_pronouns), '') = ''
    or coalesce(trim(p_bio), '') = ''
  then
    raise exception 'Name, pronouns and bio are required.';
  end if;

  if length(coalesce(p_tagline, '')) > 60 then
    raise exception 'The tagline can be at most 60 characters.';
  end if;

  if coalesce(cardinality(p_looking_for), 0) = 0 then
    raise exception 'Say what you are looking for.';
  end if;

  -- Month and year of birth are optional, but must come together and mean an adult.
  if (p_birth_year is null) <> (p_birth_month is null) then
    raise exception 'Give both a birth month and a birth year, or neither.';
  end if;
  if p_birth_year is not null then
    if p_birth_month not between 1 and 12 or p_birth_year < 1900 then
      raise exception 'Invalid birth month or year.';
    end if;
    age := extract(year from now())::int - p_birth_year;
    if extract(month from now())::int < p_birth_month then
      age := age - 1; -- this year's birthday hasn't happened yet
    end if;
    if age < 18 then
      raise exception 'You must be at least 18.';
    end if;
  end if;

  -- One to six distinct photos. (The files themselves are in the caller's own folder of the
  -- photos bucket, see docs/photos.md; this doesn't check that they exist.)
  if coalesce(cardinality(p_photos), 0) not between 1 and 6
    or cardinality(p_photos) <> (select count(distinct id) from unnest(p_photos) as id)
  then
    raise exception 'Add between 1 and 6 different photos.';
  end if;
end;
$$;

-- As before, with the field checks moved into check_profile_fields().
create or replace function public.submit_onboarding(
  p_name text,
  p_pronouns text,
  p_tagline text,
  p_bio text,
  p_location text,
  p_gender text[],
  p_sexuality text[],
  p_birth_year int,
  p_birth_month int,
  p_looking_for text[],
  p_photos uuid[],
  p_vetting_answers jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid uuid := public.require_auth_uid();
  invite_code text;
begin
  perform public.check_profile_fields(
    p_name, p_pronouns, p_tagline, p_bio, p_birth_year, p_birth_month, p_looking_for, p_photos
  );

  if coalesce(trim(p_location), '') = '' then
    raise exception 'A location is required.';
  end if;

  if jsonb_typeof(p_vetting_answers) is distinct from 'object' or p_vetting_answers = '{}' then
    raise exception 'The vetting questions must be answered.';
  end if;

  -- The invite code comes from the sign-up metadata, which the user can edit, so it is only a
  -- hint for the person vetting (and capped in length). Stored with the vetting answers, as
  -- `invite_code`, and left out if there is none.
  select left(u.raw_user_meta_data ->> 'invite_code', 100) into invite_code
  from auth.users u
  where u.id = uid;

  insert into public.profiles (
    id, status, vetting_answers, name, pronouns, tagline, bio, location, gender, sexuality,
    birth_year, birth_month, looking_for, photos
  )
  values (
    uid, 'vetting',
    p_vetting_answers || jsonb_strip_nulls(jsonb_build_object('invite_code', invite_code)),
    trim(p_name), trim(p_pronouns),
    trim(coalesce(p_tagline, '')), trim(p_bio), trim(p_location),
    coalesce(p_gender, '{}'), coalesce(p_sexuality, '{}'),
    p_birth_year, p_birth_month, p_looking_for, p_photos
  )
  on conflict (id) do nothing;

  if not found then
    raise exception 'You have already applied.' using errcode = 'unique_violation';
  end if;
end;
$$;

-- Saves every field the profile tab edits, all at once (the app sends the whole set). Only for a
-- live profile (active, hidden or an admin's): an application can't change during or after
-- vetting, and a suspended or deleted profile can't change at all. Edits go live straight away,
-- without review. Location, status, the vetting answers and the search settings stay as they are.
create or replace function public.update_profile(
  p_name text,
  p_pronouns text,
  p_tagline text,
  p_bio text,
  p_gender text[],
  p_sexuality text[],
  p_birth_year int,
  p_birth_month int,
  p_looking_for text[],
  p_photos uuid[]
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid uuid := public.require_auth_uid();
begin
  perform public.check_profile_fields(
    p_name, p_pronouns, p_tagline, p_bio, p_birth_year, p_birth_month, p_looking_for, p_photos
  );

  update public.profiles
  set name = trim(p_name),
      pronouns = trim(p_pronouns),
      tagline = trim(coalesce(p_tagline, '')),
      bio = trim(p_bio),
      gender = coalesce(p_gender, '{}'),
      sexuality = coalesce(p_sexuality, '{}'),
      birth_year = p_birth_year,
      birth_month = p_birth_month,
      looking_for = p_looking_for,
      photos = p_photos
  where id = uid and status in ('active', 'disabled', 'admin');

  if not found then
    raise exception 'There is no live profile to update.';
  end if;
end;
$$;

revoke execute on function public.check_profile_fields(
  text, text, text, text, int, int, text[], uuid[]
) from public, anon, authenticated;

revoke execute on function public.update_profile(
  text, text, text, text, text[], text[], int, int, text[], uuid[]
) from public, anon, authenticated;

grant execute on function public.update_profile(
  text, text, text, text, text[], text[], int, int, text[], uuid[]
) to authenticated;
