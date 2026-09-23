begin;
select plan(6);

insert into public.invite_codes (code, max_uses) values ('TEST-CODE', 1);

-- an unknown invite code aborts the whole signup, not just the profile creation
select throws_ok(
  $$ insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, encrypted_password, email_confirmed_at, created_at, updated_at)
     values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'bad@example.com', '{"invite_code":"WRONG"}'::jsonb, '', now(), now(), now()) $$,
  'P0001',
  'Invalid invite code.',
  'signup with an unknown invite code is rejected'
);

select is(
  (select count(*)::int from auth.users where email = 'bad@example.com'),
  0,
  'no auth.users row is left behind after a rejected invite code'
);

select lives_ok(
  $$ insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, encrypted_password, email_confirmed_at, created_at, updated_at)
     values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'good@example.com', '{"invite_code":"TEST-CODE"}'::jsonb, '', now(), now(), now()) $$,
  'signup with a valid invite code succeeds'
);

select is(
  (select count(*)::int from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  0,
  'no profile row is created at signup (only once onboarding is submitted)'
);

select is(
  (select use_count from public.invite_codes where code = 'TEST-CODE'),
  1,
  'invite code use_count is incremented'
);

-- max_uses was 1, so the code is now exhausted
select throws_ok(
  $$ insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, encrypted_password, email_confirmed_at, created_at, updated_at)
     values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'second@example.com', '{"invite_code":"TEST-CODE"}'::jsonb, '', now(), now(), now()) $$,
  'P0001',
  'This invite code has already been used.',
  'an exhausted invite code is rejected'
);

select * from finish();
rollback;
