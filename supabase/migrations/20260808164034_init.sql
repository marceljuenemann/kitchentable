-- Kitchentable schema. See docs/database.md for the rules behind it.
--
-- Access model: clients never touch the profiles table directly. Every read and write goes
-- through the security definer functions below, which check auth.uid() and enforce the allowed
-- status transitions. The one exception is the `photos` storage bucket (owner-only RLS).

create extension if not exists pgcrypto;
create extension if not exists pgtap with schema extensions;

-- profiles ------------------------------------------------------------

create type public.profile_status as enum (
  'vetting',    -- submitted, admin is reviewing
  'approved',   -- admin approved, age verification pending
  'active',     -- verified and live
  'disabled',   -- hidden by the user (not in search, can still message)
  'suspended',  -- suspended by an admin
  'deleted'     -- deleted by the user (PII scrubbed, can no longer message)
);

-- A row only exists once onboarding has been submitted; users without a row still need to
-- onboard. (Rows are not created by any function yet -- onboarding submission is not built.)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  status public.profile_status not null default 'vetting',
  -- Answers to the vetting questions, keyed by question id. Free-form JSON because the
  -- questions will change and we never filter or search on them.
  vetting_answers jsonb not null default '{}',
  name text,
  pronouns text,
  tagline text,
  bio text,
  location text,
  gender text[] not null default '{}',
  sexuality text[] not null default '{}',
  birth_year int,
  birth_month int,
  looking_for text[] not null default '{}',
  -- Ids of the profile's photos, in display order (the first is the main photo). The image files
  -- live in the `photos` bucket at <profile id>/<photo id>/full.jpg and thumb.jpg -- see
  -- docs/photos.md.
  photos uuid[] not null default '{}' check (cardinality(photos) <= 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- No client access at all: RLS on with no policies is the backstop, the revoke is the rule.
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
-- Admin tooling, webhooks and e2e fixtures use the service role.
grant all on public.profiles to service_role;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- profile functions -------------------------------------------------------

create or replace function public.require_auth_uid()
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated.';
  end if;
  return uid;
end;
$$;

-- The caller's own profile, or null if they haven't onboarded yet.
create or replace function public.get_my_profile()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(p)
  from public.profiles p
  where p.id = public.require_auth_uid();
$$;

revoke execute on function public.require_auth_uid(), public.get_my_profile()
from public, anon, authenticated;

grant execute on function public.get_my_profile() to authenticated;

-- invite_codes ------------------------------------------------------------

create table public.invite_codes (
  code text primary key,
  max_uses int not null default 1,
  use_count int not null default 0,
  created_at timestamptz not null default now()
);

-- Deliberately no RLS policies at all: this table is fully inaccessible to
-- anon/authenticated clients. It's only ever touched by handle_new_user(),
-- which runs as the function owner and bypasses RLS.
alter table public.invite_codes enable row level security;

-- auth.users -> invite codes -----------------------------------------------

-- Validates and consumes the invite code at signup. Deliberately creates no profile: that
-- only happens once the user completes onboarding (submit_onboarding).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_code text;
  matched_code public.invite_codes;
begin
  invite_code := new.raw_user_meta_data ->> 'invite_code';

  if invite_code is null or invite_code = '' then
    raise exception 'An invite code is required to apply.';
  end if;

  -- Lock the row so concurrent signups against the same shared code can't
  -- both squeeze past the max_uses check.
  select * into matched_code
  from public.invite_codes
  where code = invite_code
  for update;

  if matched_code is null then
    raise exception 'Invalid invite code.';
  end if;

  if matched_code.use_count >= matched_code.max_uses then
    raise exception 'This invite code has already been used.';
  end if;

  update public.invite_codes
  set use_count = use_count + 1
  where code = invite_code;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- storage: photos ---------------------------------------------------------

-- Images are resized and re-encoded to JPEG in the browser before upload (docs/photos.md). The
-- server can't check dimensions, so the limits here are a safety net: JPEG only, 2 MiB per file
-- (a 1080x1080 JPEG is typically 150-350 kB, up to ~900 kB for very grainy photos).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

-- Files are stored under <user_id>/<photo id>/full.jpg and thumb.jpg, uploaded during onboarding
-- before the profile row exists (profiles.photos lists the photo ids). Owner-only for now;
-- loosen when browse ships.
create policy "photos_select_own" on storage.objects
  for select using (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "photos_insert_own" on storage.objects
  for insert with check (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "photos_update_own" on storage.objects
  for update using (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "photos_delete_own" on storage.objects
  for delete using (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);
