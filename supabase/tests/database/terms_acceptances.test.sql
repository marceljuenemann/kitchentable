begin;
select plan(14);

-- Kim accepts the terms during this test, Lee never does, and Max already has.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('cccccccc-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'kim@example.com', '{}'::jsonb, '', now(), now(), now()),
  ('cccccccc-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'lee@example.com', '{}'::jsonb, '', now(), now(), now()),
  ('cccccccc-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'max@example.com', '{}'::jsonb, '', now(), now(), now());

insert into public.terms_acceptances (user_id, version, accepted_at)
values ('cccccccc-0000-0000-0000-000000000003', 1, '2026-01-01');

set local role anon;
select throws_ok($$ select * from public.terms_acceptances $$, '42501', null,
  'signed-out callers cannot read acceptances');
select throws_ok($$ insert into public.terms_acceptances (version) values (1) $$, '42501', null,
  'signed-out callers cannot accept the terms');

set local role authenticated;
set local request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000001';

select is((select count(*) from public.terms_acceptances), 0::bigint,
  'nothing is accepted at first, and other users'' acceptances are hidden');

select lives_ok($$ insert into public.terms_acceptances (version) values (1) $$,
  'a user can accept the terms');
select results_eq(
  $$ select user_id, version from public.terms_acceptances $$,
  $$ values ('cccccccc-0000-0000-0000-000000000001'::uuid, 1) $$,
  'the acceptance is recorded for the caller, and only theirs is visible'
);

select throws_ok($$ insert into public.terms_acceptances (version) values (1) $$, '23505', null,
  'accepting the same version again is a duplicate, keeping the first acceptance');
select throws_ok($$ insert into public.terms_acceptances (version) values (0) $$, '23514', null,
  'version 0 is rejected');
select throws_ok(
  $$ insert into public.terms_acceptances (user_id, version)
     values ('cccccccc-0000-0000-0000-000000000002', 1) $$,
  '42501', null, 'a user cannot accept the terms for someone else');
select throws_ok(
  $$ insert into public.terms_acceptances (version, accepted_at) values (2, '2026-01-01') $$,
  '42501', null, 'a user cannot choose the time of acceptance');
select throws_ok($$ update public.terms_acceptances set version = 2 $$, '42501', null,
  'acceptances cannot be changed');
select throws_ok($$ delete from public.terms_acceptances $$, '42501', null,
  'acceptances cannot be deleted');

reset role;
select is(
  (select accepted_at from public.terms_acceptances where user_id = 'cccccccc-0000-0000-0000-000000000001'),
  now(),
  'the time of acceptance comes from the server'
);

select throws_ok(
  $$ insert into public.profiles (id, name, pronouns, bio, location)
     values ('cccccccc-0000-0000-0000-000000000002', 'Lee', 'they/them', 'About Lee', 'London') $$,
  'P0001', 'The terms must be accepted first.',
  'a profile cannot be created without accepted terms, even with the service role');
select lives_ok(
  $$ insert into public.profiles (id, name, pronouns, bio, location)
     values ('cccccccc-0000-0000-0000-000000000001', 'Kim', 'she/her', 'About Kim', 'London') $$,
  'a profile can be created once the terms are accepted');

select * from finish();
rollback;
