begin;
select plan(7);

insert into public.invite_codes (code, max_uses) values ('RLS-TEST-A', 1), ('RLS-TEST-B', 1);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'alice@example.com', '{"invite_code":"RLS-TEST-A"}'::jsonb, '', now(), now(), now()),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'bob@example.com', '{"invite_code":"RLS-TEST-B"}'::jsonb, '', now(), now(), now());

update public.profiles set name = 'Alice' where id = '33333333-3333-3333-3333-333333333333';

-- act as alice for the rest of this test
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

select is(
  (select name from public.profiles where id = '33333333-3333-3333-3333-333333333333'),
  'Alice',
  'alice can select her own profile'
);

select lives_ok(
  $$ update public.profiles set tagline = 'hi' where id = '33333333-3333-3333-3333-333333333333' $$,
  'alice can update her own profile'
);

select is(
  (select count(*)::int from public.profiles where id = '44444444-4444-4444-4444-444444444444'),
  0,
  'alice cannot see bobs profile row'
);

-- RLS silently filters out rows alice isn't allowed to touch rather than
-- raising, so this "succeeds" (no error) but affects zero rows -- confirmed
-- by the 'bobs profile was untouched' check at the end of this file.
select lives_ok(
  $$ update public.profiles set tagline = 'hacked' where id = '44444444-4444-4444-4444-444444444444' $$,
  'attempting to update bobs profile as alice does not error'
);

-- invite_codes has no grants at all for authenticated, so this is denied at
-- the privilege level (before RLS is even evaluated), not just filtered.
select throws_ok(
  $$ select count(*) from public.invite_codes $$,
  '42501',
  'permission denied for table invite_codes',
  'invite_codes is not selectable by authenticated users'
);

select throws_ok(
  $$ insert into public.invite_codes (code, max_uses) values ('SHOULD-FAIL', 1) $$,
  '42501',
  'permission denied for table invite_codes',
  'authenticated users cannot insert invite codes'
);

reset role;

select is(
  (select tagline from public.profiles where id = '44444444-4444-4444-4444-444444444444'),
  null,
  'bobs profile was untouched by alices attempts'
);

select * from finish();
rollback;
