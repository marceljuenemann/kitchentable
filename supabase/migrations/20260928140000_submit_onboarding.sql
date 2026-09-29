-- Onboarding submission: the only way a profile row gets created. See docs/database.md.
--
-- Validates what a profile needs in order to be valid, but not the UI's own minimums (say, the
-- 250 characters asked of the bio): those are product copy and change more often than the schema.

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
  age int;
begin
  if coalesce(trim(p_name), '') = ''
    or coalesce(trim(p_pronouns), '') = ''
    or coalesce(trim(p_location), '') = ''
    or coalesce(trim(p_bio), '') = ''
  then
    raise exception 'Name, pronouns, location and bio are required.';
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

  if jsonb_typeof(p_vetting_answers) is distinct from 'object' or p_vetting_answers = '{}' then
    raise exception 'The vetting questions must be answered.';
  end if;

  -- One to six distinct photos. (The files themselves are in the caller's own folder of the
  -- photos bucket, see docs/photos.md; this doesn't check that they exist.)
  if coalesce(cardinality(p_photos), 0) not between 1 and 6
    or cardinality(p_photos) <> (select count(distinct id) from unnest(p_photos) as id)
  then
    raise exception 'Add between 1 and 6 different photos.';
  end if;

  insert into public.profiles (
    id, status, vetting_answers, name, pronouns, tagline, bio, location, gender, sexuality,
    birth_year, birth_month, looking_for, photos
  )
  values (
    uid, 'vetting', p_vetting_answers, trim(p_name), trim(p_pronouns),
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

revoke execute on function public.submit_onboarding(
  text, text, text, text, text, text[], text[], int, int, text[], uuid[], jsonb
) from public, anon, authenticated;

grant execute on function public.submit_onboarding(
  text, text, text, text, text, text[], text[], int, int, text[], uuid[], jsonb
) to authenticated;
