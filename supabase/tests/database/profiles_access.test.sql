begin;
select plan(6);

insert into public.invite_codes (code, max_uses) values ('ACCESS-TEST', 2);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'alice@example.com', '{"invite_code":"ACCESS-TEST"}'::jsonb, '', now(), now(), now()),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'bob@example.com', '{"invite_code":"ACCESS-TEST"}'::jsonb, '', now(), now(), now());

insert into public.profiles (id, name, pronouns, bio, location)
values ('44444444-4444-4444-4444-444444444444', 'Bob', 'he/him', 'About Bob', 'London');

-- act as alice for the rest of this test
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

select is(public.get_my_profile(), null, 'get_my_profile is null before onboarding');

select throws_ok(
  $$ select * from public.profiles $$,
  '42501',
  'permission denied for table profiles',
  'profiles cannot be selected directly'
);

select throws_ok(
  $$ update public.profiles set name = 'hacked' where id = '44444444-4444-4444-4444-444444444444' $$,
  '42501',
  'permission denied for table profiles',
  'profiles cannot be updated directly'
);

select throws_ok(
  $$ insert into public.profiles (id) values ('33333333-3333-3333-3333-333333333333') $$,
  '42501',
  'permission denied for table profiles',
  'profiles cannot be inserted directly'
);

select throws_ok(
  $$ select count(*) from public.invite_codes $$,
  '42501',
  'permission denied for table invite_codes',
  'invite_codes is not selectable by authenticated users'
);

-- an anonymous caller (no sub claim) can't use the procedures either
reset role;
set local role anon;
select throws_ok(
  $$ select public.get_my_profile() $$,
  '42501',
  'permission denied for function get_my_profile',
  'anon cannot call get_my_profile'
);

select * from finish();
rollback;
