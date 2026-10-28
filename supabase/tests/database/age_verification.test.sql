begin;
select plan(8);

-- Amy is approved and waiting for her age check, Ben is still being vetted, Cat is suspended.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('cccccccc-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'amy@example.com', '{}'::jsonb, '', now(), now(), now()),
  ('cccccccc-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'ben@example.com', '{}'::jsonb, '', now(), now(), now()),
  ('cccccccc-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'cat@example.com', '{}'::jsonb, '', now(), now(), now());

insert into public.terms_acceptances (user_id, version) values
  ('cccccccc-0000-0000-0000-000000000001', 1),
  ('cccccccc-0000-0000-0000-000000000002', 1),
  ('cccccccc-0000-0000-0000-000000000003', 1);

insert into public.profiles (id, status, name, pronouns, bio, location) values
  ('cccccccc-0000-0000-0000-000000000001', 'approved', 'Amy', 'she/her', 'About Amy', 'London'),
  ('cccccccc-0000-0000-0000-000000000002', 'vetting', 'Ben', 'he/him', 'About Ben', 'London'),
  ('cccccccc-0000-0000-0000-000000000003', 'suspended', 'Cat', 'they/them', 'About Cat', 'London');

-- Users can't activate themselves ---------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000001';

select throws_ok(
  $$ select public.complete_age_verification('cccccccc-0000-0000-0000-000000000001') $$,
  '42501', null, 'a user cannot complete their own age verification'
);

reset role;

-- The webhook (service role) --------------------------------------------

set local role service_role;

select is(public.complete_age_verification('cccccccc-0000-0000-0000-000000000001'), true,
  'an approved profile is activated');

reset role;

select is(
  (select status::text from public.profiles where id = 'cccccccc-0000-0000-0000-000000000001'),
  'active', 'the profile is now active'
);
select isnt(
  (select age_verified_at from public.profiles where id = 'cccccccc-0000-0000-0000-000000000001'),
  null, 'the time of the check is recorded'
);

set local role service_role;

select is(public.complete_age_verification('cccccccc-0000-0000-0000-000000000001'), false,
  'a retried webhook changes nothing');
select is(public.complete_age_verification('cccccccc-0000-0000-0000-000000000002'), false,
  'a profile still in vetting is not activated');
select is(public.complete_age_verification('cccccccc-0000-0000-0000-000000000003'), false,
  'a suspended profile is not activated');

reset role;

select is(
  (select array_agg(status::text order by name) from public.profiles
   where id in ('cccccccc-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000003')),
  array['vetting', 'suspended'], 'the other profiles keep their status'
);

select * from finish();
rollback;
