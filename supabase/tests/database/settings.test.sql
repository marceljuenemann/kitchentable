begin;
select plan(8);

-- Ivy is a live member; Jo has signed up but not onboarded.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, encrypted_password, email_confirmed_at, created_at, updated_at)
select id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  email, '{}'::jsonb, '', now(), now(), now()
from (values
  ('e1000000-0000-0000-0000-000000000001', 'ivy@example.com'),
  ('e1000000-0000-0000-0000-000000000002', 'jo@example.com')
) as u (id, email);

insert into public.terms_acceptances (user_id, version)
select id, 1 from auth.users where id::text like 'e1000000-%';

insert into public.profiles (id, status, name, pronouns, bio, location)
values ('e1000000-0000-0000-0000-000000000001', 'active', 'Ivy', 'she/her', 'About Ivy', 'London');

select is(
  (select row(intro_emails, message_emails)::text from public.profiles
   where id = 'e1000000-0000-0000-0000-000000000001'),
  row(true, true)::text,
  'a new profile gets both kinds of email'
);

set local role anon;
select throws_ok(
  $$ select public.update_settings(false, false) $$,
  '42501', null, 'signed-out callers cannot change settings');

set local role authenticated;
set local request.jwt.claim.sub = 'e1000000-0000-0000-0000-000000000001';

select lives_ok($$ select public.update_settings(true, false) $$, 'a member can change their settings');
select is(
  public.get_my_profile() -> 'intro_emails',
  'true'::jsonb,
  'each setting is stored as sent'
);
select is(
  public.get_my_profile() -> 'message_emails',
  'false'::jsonb,
  'the member gets their settings with their profile'
);

select throws_ok(
  $$ select public.update_settings(null, true) $$,
  'P0001', 'Invalid settings.', 'a missing setting is rejected');

reset role;
select is(
  (select row(intro_emails, message_emails)::text from public.profiles
   where id = 'e1000000-0000-0000-0000-000000000001'),
  row(true, false)::text,
  'a rejected call changes nothing'
);

set local role authenticated;
set local request.jwt.claim.sub = 'e1000000-0000-0000-0000-000000000002';
select throws_ok(
  $$ select public.update_settings(true, true) $$,
  'P0001', 'There is no profile.', 'someone without a profile cannot change settings');

select * from finish();
rollback;
