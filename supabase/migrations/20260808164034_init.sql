create extension if not exists pgcrypto;

-- profiles ------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  application_status text not null default 'draft'
    check (application_status in ('draft', 'pending', 'approved', 'rejected')),
  application_submitted_at timestamptz,
  application_consent_answer text,
  application_enm_answer text,
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Postgres grants nothing to anon/authenticated on a newly created table by
-- default (that only happens automatically for tables made via the Studio
-- table editor) -- RLS policies are meaningless without this base grant.
grant select, update on public.profiles to authenticated;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- No insert policy: rows are only ever created by handle_new_user() below.
-- No public read policy yet: browse doesn't exist in this pass.

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

-- An application can only move to 'pending' once it's actually complete,
-- so an empty/trivial application is structurally impossible to submit.
create or replace function public.enforce_application_submission()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.application_status = 'pending' and old.application_status is distinct from 'pending' then
    if coalesce(new.name, '') = '' then
      raise exception 'name is required before submitting';
    end if;
    if coalesce(new.tagline, '') = '' then
      raise exception 'tagline is required before submitting';
    end if;
    if coalesce(new.bio, '') = '' then
      raise exception 'bio is required before submitting';
    end if;
    if coalesce(new.location, '') = '' then
      raise exception 'location is required before submitting';
    end if;
    if coalesce(new.application_consent_answer, '') = '' then
      raise exception 'consent answer is required before submitting';
    end if;
    if coalesce(new.application_enm_answer, '') = '' then
      raise exception 'ENM answer is required before submitting';
    end if;
    if coalesce(array_length(new.gender, 1), 0) = 0 then
      raise exception 'gender is required before submitting';
    end if;
    if coalesce(array_length(new.sexuality, 1), 0) = 0 then
      raise exception 'sexuality is required before submitting';
    end if;
    if not exists (select 1 from public.profile_photos where profile_id = new.id) then
      raise exception 'at least one photo is required before submitting';
    end if;

    new.application_submitted_at := now();
  end if;

  return new;
end;
$$;

-- profile_photos --------------------------------------------------------

create table public.profile_photos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index profile_photos_profile_id_idx on public.profile_photos (profile_id);

alter table public.profile_photos enable row level security;

grant select, insert, update, delete on public.profile_photos to authenticated;

create policy "profile_photos_select_own" on public.profile_photos
  for select using (auth.uid() = profile_id);

create policy "profile_photos_insert_own" on public.profile_photos
  for insert with check (auth.uid() = profile_id);

create policy "profile_photos_update_own" on public.profile_photos
  for update using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

create policy "profile_photos_delete_own" on public.profile_photos
  for delete using (auth.uid() = profile_id);

-- The submission-gate trigger above needs to see photo rows, so it must be
-- created after profile_photos exists.
create trigger profiles_enforce_submission
  before update on public.profiles
  for each row execute function public.enforce_application_submission();

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

-- auth.users -> profiles -------------------------------------------------

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

  insert into public.profiles (id, application_status)
  values (new.id, 'draft');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- storage: photos ---------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

-- Files are stored under <user_id>/<filename>. Owner-only for now, matching
-- profiles having no public read yet; loosen when browse ships.
create policy "photos_select_own" on storage.objects
  for select using (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "photos_insert_own" on storage.objects
  for insert with check (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "photos_update_own" on storage.objects
  for update using (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "photos_delete_own" on storage.objects
  for delete using (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);
