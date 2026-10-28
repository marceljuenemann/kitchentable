begin;
select plan(16);

-- Erin signed up with an invite code, Finn without one.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('88888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'erin@example.com', '{"invite_code":"SUBMIT-TEST"}'::jsonb, '', now(), now(), now()),
  ('99999999-9999-9999-9999-999999999999', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'finn@example.com', '{}'::jsonb, '', now(), now(), now());

insert into public.terms_acceptances (user_id, version) values
  ('88888888-8888-8888-8888-888888888888', 1),
  ('99999999-9999-9999-9999-999999999999', 1);

-- A valid call, with one argument overridden per test below (rolled back with the rest).
create function public.test_submit(
  p_name text default 'Erin',
  p_bio text default 'About Erin',
  p_birth_year int default null,
  p_birth_month int default null,
  p_looking_for text[] default '{polyamory}',
  p_photos uuid[] default '{aaaaaaaa-0000-0000-0000-000000000001,aaaaaaaa-0000-0000-0000-000000000002}',
  p_vetting_answers jsonb default '{"consent": "yes"}',
  p_tagline text default 'Hi'
) returns void language sql as $$
  select public.submit_onboarding(
    p_name, 'they/them', p_tagline, p_bio, 'London', '{Woman}', '{Queer}',
    p_birth_year, p_birth_month, p_looking_for, p_photos, p_vetting_answers
  );
$$;
grant execute on function public.test_submit to authenticated;

set local role authenticated;
set local request.jwt.claim.sub = '88888888-8888-8888-8888-888888888888';

select throws_ok($$ select public.test_submit(p_name => '  ') $$, 'P0001',
  'Name, pronouns, location and bio are required.', 'a blank name is rejected');
select throws_ok($$ select public.test_submit(p_tagline => repeat('x', 61)) $$, 'P0001',
  'The tagline can be at most 60 characters.', 'a tagline over 60 characters is rejected');
select throws_ok($$ select public.test_submit(p_looking_for => '{}') $$, 'P0001',
  'Say what you are looking for.', 'looking for is required');
select throws_ok($$ select public.test_submit(p_birth_year => 2000) $$, 'P0001',
  'Give both a birth month and a birth year, or neither.', 'birth month and year come together');
select throws_ok(
  $$ select public.test_submit(p_birth_year => extract(year from now())::int - 17, p_birth_month => 1) $$,
  'P0001', 'You must be at least 18.', 'someone who is still 17 is rejected');
select throws_ok($$ select public.test_submit(p_vetting_answers => '{}') $$, 'P0001',
  'The vetting questions must be answered.', 'vetting answers are required');
select throws_ok($$ select public.test_submit(p_photos => '{}') $$, 'P0001',
  'Add between 1 and 6 different photos.', 'at least one photo is required');
select throws_ok(
  $$ select public.test_submit(p_photos => '{aaaaaaaa-0000-0000-0000-000000000001,aaaaaaaa-0000-0000-0000-000000000001}') $$,
  'P0001', 'Add between 1 and 6 different photos.', 'the same photo twice is rejected');

select is(public.get_my_profile(), null, 'nothing was created by the rejected calls');

select lives_ok(
  $$ select public.test_submit(p_name => ' Erin ', p_birth_year => 1990, p_birth_month => 6, p_tagline => '') $$,
  'a valid submission works');

select is(
  public.get_my_profile() - 'created_at' - 'updated_at',
  '{
    "id": "88888888-8888-8888-8888-888888888888", "status": "vetting", "name": "Erin",
    "pronouns": "they/them", "tagline": "", "bio": "About Erin", "location": "London",
    "gender": ["Woman"], "sexuality": ["Queer"], "birth_year": 1990, "birth_month": 6,
    "looking_for": ["polyamory"],
    "photos": ["aaaaaaaa-0000-0000-0000-000000000001", "aaaaaaaa-0000-0000-0000-000000000002"],
    "age_verified_at": null
  }'::jsonb,
  'the profile is created in vetting with the trimmed, submitted values (and is read back without the vetting answers)'
);

select throws_ok($$ select public.test_submit() $$, '23505', 'You have already applied.',
  'submitting twice is rejected');

set local request.jwt.claim.sub = '99999999-9999-9999-9999-999999999999';
select lives_ok($$ select public.test_submit() $$, 'someone who signed up without an invite code can submit');

reset role;
select is(
  (select vetting_answers from public.profiles where id = '88888888-8888-8888-8888-888888888888'),
  '{"consent": "yes", "invite_code": "SUBMIT-TEST"}'::jsonb,
  'the vetting answers are stored together with the sign-up invite code');
select is(
  (select vetting_answers from public.profiles where id = '99999999-9999-9999-9999-999999999999'),
  '{"consent": "yes"}'::jsonb,
  'without an invite code, only the answers are stored');

set local role anon;
select throws_ok(
  $$ select public.submit_onboarding('a', 'b', null, 'c', 'd', '{}', '{}', null, null, '{x}', '{}', '{}') $$,
  '42501', 'permission denied for function submit_onboarding', 'anon cannot submit');

select * from finish();
rollback;
