begin;
select plan(15);

-- Kai is a live member with saved search settings, Lou has hidden their profile, Max is an admin,
-- Noa is being vetted, Oli is suspended, and Pat has signed up without onboarding.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, encrypted_password, email_confirmed_at, created_at, updated_at)
select id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  email, '{}'::jsonb, '', now(), now(), now()
from (values
  ('c1000000-0000-0000-0000-000000000001', 'kai@example.com'),
  ('c1000000-0000-0000-0000-000000000002', 'lou@example.com'),
  ('c1000000-0000-0000-0000-000000000003', 'max@example.com'),
  ('c1000000-0000-0000-0000-000000000004', 'noa@example.com'),
  ('c1000000-0000-0000-0000-000000000005', 'oli@example.com'),
  ('c1000000-0000-0000-0000-000000000006', 'pat@example.com')
) as u (id, email);

insert into public.terms_acceptances (user_id, version)
select id, 1 from auth.users where id::text like 'c1000000-%';

insert into public.profiles (id, status, name, pronouns, bio, location, looking_for, photos, vetting_answers, search_filters, hide_by_gender)
values (
  'c1000000-0000-0000-0000-000000000001', 'active', 'Kai', 'he/him', 'About Kai', 'London',
  '{friends}', '{bbbbbbbb-0000-0000-0000-000000000001}', '{"consent": "yes"}',
  '{"looking_for": [], "gender": ["Woman"], "min_age": 18, "max_age": 70, "show_unspecified_age": true}', true
);
insert into public.profiles (id, status, name, pronouns, bio, location)
values
  ('c1000000-0000-0000-0000-000000000002', 'disabled', 'Lou', 'she/her', 'About Lou', 'London'),
  ('c1000000-0000-0000-0000-000000000003', 'admin', 'Max', 'they/them', 'About Max', 'London'),
  ('c1000000-0000-0000-0000-000000000004', 'vetting', 'Noa', 'she/her', 'About Noa', 'London'),
  ('c1000000-0000-0000-0000-000000000005', 'suspended', 'Oli', 'he/him', 'About Oli', 'London');

-- A valid call, with one argument overridden per test below (rolled back with the rest).
create function public.test_update(
  p_name text default 'Kai',
  p_tagline text default 'Hi',
  p_birth_year int default null,
  p_birth_month int default null,
  p_photos uuid[] default '{bbbbbbbb-0000-0000-0000-000000000002,bbbbbbbb-0000-0000-0000-000000000001}'
) returns void language sql as $$
  select public.update_profile(
    p_name, 'they/them', p_tagline, 'About Kai, edited', '{Non-binary}', '{Queer}',
    p_birth_year, p_birth_month, '{friends,casual}', p_photos
  );
$$;
grant execute on function public.test_update to authenticated;

set local role anon;
select throws_ok($$ select public.test_update() $$, '42501', null,
  'signed-out callers cannot update a profile');

set local role authenticated;
set local request.jwt.claim.sub = 'c1000000-0000-0000-0000-000000000001';

-- The same checks as onboarding (check_profile_fields), a few of them as a sample.
select throws_ok($$ select public.test_update(p_name => ' ') $$, 'P0001',
  'Name, pronouns and bio are required.', 'a blank name is rejected');
select throws_ok($$ select public.test_update(p_tagline => repeat('x', 61)) $$, 'P0001',
  'The tagline can be at most 60 characters.', 'a tagline over 60 characters is rejected');
select throws_ok($$ select public.test_update(p_photos => '{}') $$, 'P0001',
  'Add between 1 and 6 different photos.', 'the last photo cannot be removed');
select throws_ok(
  $$ select public.test_update(p_birth_year => extract(year from now())::int - 17, p_birth_month => 1) $$,
  'P0001', 'You must be at least 18.', 'the age check applies to edits too');
select throws_ok($$ select public.check_profile_fields('a', 'b', '', 'c', null, null, '{x}', '{}') $$,
  '42501', null, 'members cannot call the checks themselves');

select lives_ok(
  $$ select public.test_update(p_name => ' Kai ', p_tagline => ' Hello ', p_birth_year => 1990, p_birth_month => 4) $$,
  'a live member can update their profile');

reset role;
select is(
  (select jsonb_build_object(
    'name', name, 'pronouns', pronouns, 'tagline', tagline, 'bio', bio, 'gender', gender,
    'sexuality', sexuality, 'birth_year', birth_year, 'birth_month', birth_month,
    'looking_for', looking_for, 'photos', photos)
   from public.profiles where id = 'c1000000-0000-0000-0000-000000000001'),
  '{
    "name": "Kai", "pronouns": "they/them", "tagline": "Hello", "bio": "About Kai, edited",
    "gender": ["Non-binary"], "sexuality": ["Queer"], "birth_year": 1990, "birth_month": 4,
    "looking_for": ["friends", "casual"],
    "photos": ["bbbbbbbb-0000-0000-0000-000000000002", "bbbbbbbb-0000-0000-0000-000000000001"]
  }'::jsonb,
  'the edited fields are stored, trimmed, with the photos in their new order'
);
select is(
  (select jsonb_build_object(
    'status', status, 'location', location, 'vetting_answers', vetting_answers,
    'search_filters', search_filters, 'hide_by_gender', hide_by_gender)
   from public.profiles where id = 'c1000000-0000-0000-0000-000000000001'),
  '{
    "status": "active", "location": "London", "vetting_answers": {"consent": "yes"},
    "search_filters": {"looking_for": [], "gender": ["Woman"], "min_age": 18, "max_age": 70, "show_unspecified_age": true},
    "hide_by_gender": true
  }'::jsonb,
  'the status, location, vetting answers and search settings stay as they were'
);
select is(
  (select name from public.profiles where id = 'c1000000-0000-0000-0000-000000000002'),
  'Lou', 'nobody else''s profile changes');

set local role authenticated;
set local request.jwt.claim.sub = 'c1000000-0000-0000-0000-000000000002';
select lives_ok($$ select public.test_update() $$, 'someone who hid their profile can update it');

set local request.jwt.claim.sub = 'c1000000-0000-0000-0000-000000000003';
select lives_ok($$ select public.test_update() $$, 'an admin can update their profile');

set local request.jwt.claim.sub = 'c1000000-0000-0000-0000-000000000004';
select throws_ok($$ select public.test_update() $$, 'P0001', 'There is no live profile to update.',
  'an application cannot be changed while it is vetted');

set local request.jwt.claim.sub = 'c1000000-0000-0000-0000-000000000005';
select throws_ok($$ select public.test_update() $$, 'P0001', 'There is no live profile to update.',
  'a suspended profile cannot be changed');

set local request.jwt.claim.sub = 'c1000000-0000-0000-0000-000000000006';
select throws_ok($$ select public.test_update() $$, 'P0001', 'There is no live profile to update.',
  'someone who has not onboarded has no profile to update');

select * from finish();
rollback;
