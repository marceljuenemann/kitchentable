-- Acceptance of the Terms of Use, together with the explicit consent the Privacy Policy asks for
-- (to process special category data). Both are given on one screen once the email address is
-- confirmed, and are needed before creating a profile. See docs/database.md.

create table public.terms_acceptances (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Raised only when a change needs everyone to accept again. It is separate from the version
  -- printed on each document.
  version int not null check (version > 0),
  accepted_at timestamptz not null default now(),
  primary key (user_id, version)
);

-- Unlike profiles, clients use this table directly (through the REST API), since the rules are
-- this simple: users can read their own rows and add one for themselves, but never change or
-- remove one. Only `version` can be inserted, so the user and the time always come from the
-- server.
alter table public.terms_acceptances enable row level security;
revoke all on public.terms_acceptances from anon, authenticated;
grant select, insert (version) on public.terms_acceptances to authenticated;
grant all on public.terms_acceptances to service_role;

create policy "terms_acceptances_select_own" on public.terms_acceptances
  for select to authenticated using (user_id = (select auth.uid()));

create policy "terms_acceptances_insert_own" on public.terms_acceptances
  for insert to authenticated with check (user_id = (select auth.uid()));

-- No profile without accepted terms, however the row is inserted (submit_onboarding, Studio or
-- a fixture). Any version will do: being asked again for a new one doesn't undo the first.
create or replace function public.require_terms_accepted()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (select 1 from public.terms_acceptances where user_id = new.id) then
    raise exception 'The terms must be accepted first.';
  end if;
  return new;
end;
$$;

revoke execute on function public.require_terms_accepted() from public, anon, authenticated;

create trigger profiles_require_terms_accepted
  before insert on public.profiles
  for each row execute function public.require_terms_accepted();
