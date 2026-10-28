begin;
select plan(15);

-- Ada is an admin, Mia an active member, Ivy and Jon applicants.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'ada@example.com', '{}'::jsonb, '', now(), now(), now()),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'mia@example.com', '{}'::jsonb, '', now(), now(), now()),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'ivy@example.com', '{}'::jsonb, '', now(), now(), now()),
  ('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'jon@example.com', '{}'::jsonb, '', now(), now(), now());

insert into public.terms_acceptances (user_id, version) values
  ('a0000000-0000-0000-0000-000000000001', 1),
  ('a0000000-0000-0000-0000-000000000002', 1),
  ('a0000000-0000-0000-0000-000000000003', 1),
  ('a0000000-0000-0000-0000-000000000004', 1);

insert into public.profiles (id, status, name, pronouns, bio, location, photos, vetting_answers, created_at) values
  ('a0000000-0000-0000-0000-000000000001', 'admin', 'Kitchen Table', '-', '-', '-', '{}', '{}', now()),
  ('a0000000-0000-0000-0000-000000000002', 'active', 'Mia', 'she/her', 'About Mia', 'London', '{}', '{}', now()),
  -- Jon applied after Ivy, so he comes second in the list.
  ('a0000000-0000-0000-0000-000000000004', 'vetting', 'Jon', 'he/him', 'About Jon', 'London',
    '{}', '{"consent": "Jon on consent"}', now() - interval '1 day'),
  ('a0000000-0000-0000-0000-000000000003', 'vetting', 'Ivy', 'she/her', 'About Ivy', 'London',
    array['bbbbbbbb-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001']::uuid[],
    '{"consent": "Ivy on consent", "invite_code": "IVY-CODE"}', now() - interval '2 days');

insert into storage.objects (bucket_id, name) values
  ('photos', 'a0000000-0000-0000-0000-000000000003/bbbbbbbb-0000-0000-0000-000000000001/thumb.jpg');

-- A member -------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000002';

select is(public.is_admin(), false, 'a member is not an admin');
select throws_ok($$ select public.admin_list_applications() $$, '42501', 'Admins only.',
  'a member cannot list applications');
select throws_ok($$ select public.admin_approve_application('a0000000-0000-0000-0000-000000000003') $$,
  '42501', 'Admins only.', 'a member cannot approve an application');
select is(
  (select count(*) from storage.objects where name like 'a0000000-0000-0000-0000-000000000003/%'),
  0::bigint,
  'a member cannot see another user''s photos'
);

-- A signed-in user without a profile is not an admin either.
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000099';
select is(public.is_admin(), false, 'a user without a profile is not an admin');

-- The admin ------------------------------------------------------------

set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';

-- Only this test's users: a local database has other applications too.
create temporary view test_applications as
  select a from jsonb_array_elements(public.admin_list_applications()) a
  where a ->> 'id' like 'a0000000-%';

select is(public.is_admin(), true, 'a profile in status admin is an admin');
select is(
  (select jsonb_agg(a -> 'name') from test_applications),
  '["Ivy", "Jon"]'::jsonb,
  'lists only applications in vetting, oldest first'
);
select is(
  (select a -> 'vetting_answers' from test_applications where a ->> 'name' = 'Ivy'),
  '{"consent": "Ivy on consent", "invite_code": "IVY-CODE"}'::jsonb,
  'the list has the vetting answers, invite code included'
);
select is(
  (select a -> 'photos' from test_applications where a ->> 'name' = 'Ivy'),
  '["bbbbbbbb-0000-0000-0000-000000000002", "bbbbbbbb-0000-0000-0000-000000000001"]'::jsonb,
  'the list has the whole profile, photos in display order included'
);
select is(
  (select count(*) from storage.objects where name like 'a0000000-0000-0000-0000-000000000003/%'),
  1::bigint,
  'the admin can see another user''s photos'
);

select lives_ok($$ select public.admin_approve_application('a0000000-0000-0000-0000-000000000003') $$,
  'the admin can approve an application');
select is(
  (select jsonb_agg(a -> 'name') from test_applications),
  '["Jon"]'::jsonb,
  'an approved application leaves the list'
);
select throws_ok($$ select public.admin_approve_application('a0000000-0000-0000-0000-000000000003') $$,
  'P0001', 'There is no application waiting for review with this id.',
  'an application cannot be approved twice');

reset role;
select is(
  (select status from public.profiles where id = 'a0000000-0000-0000-0000-000000000003'),
  'approved'::public.profile_status,
  'approving sets the status to approved'
);

-- Anonymous ------------------------------------------------------------

set local role anon;
select throws_ok($$ select public.admin_list_applications() $$, '42501',
  'permission denied for function admin_list_applications', 'anon cannot call the admin functions');

select * from finish();
rollback;
