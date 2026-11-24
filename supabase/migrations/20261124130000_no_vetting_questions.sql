-- Onboarding no longer asks the vetting questions, so an application can come without answers:
-- `p_vetting_answers` may now be empty (but must still be an object). It stays a parameter, so
-- the questions can come back without changing the API. The invite code is still stored with it.

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

  if jsonb_typeof(p_vetting_answers) is distinct from 'object' then
    raise exception 'The vetting answers must be an object (it may be empty).';
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
