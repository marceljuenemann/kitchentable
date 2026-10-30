begin;
select plan(12);

-- Ivy is a live member; Jo has signed up but not onboarded.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, encrypted_password, email_confirmed_at, created_at, updated_at)
select id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  email, '{}'::jsonb, '', now(), now(), now()
from (values
  ('e0000000-0000-0000-0000-000000000001', 'ivy@example.com'),
  ('e0000000-0000-0000-0000-000000000002', 'jo@example.com')
) as u (id, email);

insert into public.terms_acceptances (user_id, version)
select id, 1 from auth.users where id::text like 'e0000000-%';

insert into public.profiles (id, status, name, pronouns, bio, location)
values ('e0000000-0000-0000-0000-000000000001', 'active', 'Ivy', 'she/her', 'About Ivy', 'London');

select is(
  (select row(search_filters, hide_by_gender)::text from public.profiles
   where id = 'e0000000-0000-0000-0000-000000000001'),
  row(null::jsonb, false)::text,
  'a new profile has no saved filters and hides from nobody'
);

set local role anon;
select throws_ok(
  $$ select public.set_search_filters('{"looking_for": [], "gender": [], "min_age": 18, "max_age": 70, "show_unspecified_age": true}', false) $$,
  '42501', null, 'signed-out callers cannot save filters');

set local role authenticated;
set local request.jwt.claim.sub = 'e0000000-0000-0000-0000-000000000001';

select lives_ok(
  $$ select public.set_search_filters('{"looking_for": ["friends", "self-described"], "gender": ["Woman", "not-specified"], "min_age": 25, "max_age": 40, "show_unspecified_age": false}', true) $$,
  'a member can save their filters');
reset role;
select is(
  (select row(search_filters, hide_by_gender)::text from public.profiles
   where id = 'e0000000-0000-0000-0000-000000000001'),
  row('{"looking_for": ["friends", "self-described"], "gender": ["Woman", "not-specified"], "min_age": 25, "max_age": 40, "show_unspecified_age": false}'::jsonb, true)::text,
  'the filters and the switch are stored'
);

set local role authenticated;
select lives_ok(
  $$ select public.set_search_filters('{"looking_for": [], "gender": [], "min_age": 18, "max_age": 70, "show_unspecified_age": true}', true) $$,
  'the switch can be sent with no gender picked');
reset role;
select is(
  (select hide_by_gender from public.profiles where id = 'e0000000-0000-0000-0000-000000000001'),
  false,
  'without a Gender filter, nobody is hidden from'
);

set local role authenticated;
select throws_ok(
  $$ select public.set_search_filters('{"looking_for": [], "gender": ["Martian"], "min_age": 18, "max_age": 70, "show_unspecified_age": true}', false) $$,
  'P0001', 'Invalid search filters.', 'unknown gender values are rejected');
select throws_ok(
  $$ select public.set_search_filters('{"looking_for": ["Something of my own"], "gender": [], "min_age": 18, "max_age": 70, "show_unspecified_age": true}', false) $$,
  'P0001', 'Invalid search filters.', 'looking-for values other than the filter values are rejected');
select throws_ok(
  $$ select public.set_search_filters('{"looking_for": [], "gender": [], "min_age": 40, "max_age": 30, "show_unspecified_age": true}', false) $$,
  'P0001', 'Invalid search filters.', 'an age range the wrong way round is rejected');
select throws_ok(
  $$ select public.set_search_filters('{"looking_for": [], "gender": [], "min_age": 18, "max_age": 70, "show_unspecified_age": true, "extra": 1}', false) $$,
  'P0001', 'Invalid search filters.', 'unknown keys are rejected');
select throws_ok(
  $$ select public.set_search_filters('{"looking_for": [], "gender": [], "min_age": 18, "max_age": 70}', false) $$,
  'P0001', 'Invalid search filters.', 'missing keys are rejected');

set local request.jwt.claim.sub = 'e0000000-0000-0000-0000-000000000002';
select throws_ok(
  $$ select public.set_search_filters('{"looking_for": [], "gender": [], "min_age": 18, "max_age": 70, "show_unspecified_age": true}', false) $$,
  'P0001', 'There is no profile.', 'someone without a profile cannot save filters');

select * from finish();
rollback;
