begin;
select plan(31);

-- Moves any profiles already in the database out of the way (Playwright leaves active members in
-- London behind), so the lists below are exact.
update public.profiles set location = 'Somewhere else';

-- Amy (a woman in London) searches. Everyone else is someone she should or shouldn't see:
-- Ben, Gil, Jo and Kai are live members in London she may see; Cat lives elsewhere; Dan has
-- hidden his profile, Eve has deleted hers and Sid is suspended; Fay only shows herself to men;
-- Hal was dismissed by Amy; Ivy has sent her an intro, Lou is connected with her and Max was;
-- Ada is the admin; Val is still being vetted and Una is yet to verify her age; Noa has no
-- profile.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, encrypted_password, email_confirmed_at, created_at, updated_at)
select id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  email, '{}'::jsonb, '', now(), now(), now()
from (values
  ('f0000000-0000-0000-0000-000000000001', 'amy@example.com'),
  ('f0000000-0000-0000-0000-000000000002', 'ben@example.com'),
  ('f0000000-0000-0000-0000-000000000003', 'cat@example.com'),
  ('f0000000-0000-0000-0000-000000000004', 'dan@example.com'),
  ('f0000000-0000-0000-0000-000000000005', 'eve@example.com'),
  ('f0000000-0000-0000-0000-000000000006', 'fay@example.com'),
  ('f0000000-0000-0000-0000-000000000007', 'gil@example.com'),
  ('f0000000-0000-0000-0000-000000000008', 'hal@example.com'),
  ('f0000000-0000-0000-0000-000000000009', 'ivy@example.com'),
  ('f0000000-0000-0000-0000-000000000010', 'jo@example.com'),
  ('f0000000-0000-0000-0000-000000000011', 'kai@example.com'),
  ('f0000000-0000-0000-0000-000000000012', 'ada@example.com'),
  ('f0000000-0000-0000-0000-000000000013', 'val@example.com'),
  ('f0000000-0000-0000-0000-000000000014', 'max@example.com'),
  ('f0000000-0000-0000-0000-000000000015', 'noa@example.com'),
  ('f0000000-0000-0000-0000-000000000016', 'una@example.com'),
  ('f0000000-0000-0000-0000-000000000017', 'sid@example.com'),
  ('f0000000-0000-0000-0000-000000000018', 'lou@example.com')
) as u (id, email);

insert into public.terms_acceptances (user_id, version)
select id, 1 from auth.users where id::text like 'f0000000-%';

-- Jo joined most recently, then Ben, Gil and Kai. Jo turned 30 last month.
insert into public.profiles (id, status, name, pronouns, bio, location, gender, birth_year, birth_month, age_verified_at) values
  ('f0000000-0000-0000-0000-000000000001', 'active', 'Amy', 'she/her', 'About Amy', 'London', '{Woman}', null, null, now() - interval '9 days'),
  ('f0000000-0000-0000-0000-000000000002', 'active', 'Ben', 'he/him', 'About Ben', 'London', '{Man}', null, null, now() - interval '3 days'),
  ('f0000000-0000-0000-0000-000000000003', 'active', 'Cat', 'they/them', 'About Cat', 'Manchester', '{}', null, null, now()),
  ('f0000000-0000-0000-0000-000000000004', 'disabled', 'Dan', 'he/him', 'About Dan', 'London', '{Man}', null, null, now()),
  ('f0000000-0000-0000-0000-000000000005', 'deleted', 'Eve', 'she/her', 'About Eve', 'London', '{Woman}', null, null, now()),
  ('f0000000-0000-0000-0000-000000000006', 'active', 'Fay', 'she/her', 'About Fay', 'London', '{Woman}', null, null, now()),
  ('f0000000-0000-0000-0000-000000000007', 'active', 'Gil', 'he/him', 'About Gil', 'London', '{Woman}', null, null, now() - interval '5 days'),
  ('f0000000-0000-0000-0000-000000000008', 'active', 'Hal', 'he/him', 'About Hal', 'London', '{Man}', null, null, now()),
  ('f0000000-0000-0000-0000-000000000009', 'active', 'Ivy', 'she/her', 'About Ivy', 'London', '{Woman}', null, null, now()),
  ('f0000000-0000-0000-0000-000000000010', 'active', 'Jo', 'they/them', 'About Jo', 'london', '{Two-spirit}',
    extract(year from now() - interval '30 years 1 month'), extract(month from now() - interval '30 years 1 month'),
    now() - interval '1 day'),
  ('f0000000-0000-0000-0000-000000000011', 'active', 'Kai', 'they/them', 'About Kai', 'London', '{}', null, null, now() - interval '7 days'),
  ('f0000000-0000-0000-0000-000000000012', 'admin', 'Kitchen Table', '-', '-', 'London', '{}', null, null, null),
  ('f0000000-0000-0000-0000-000000000013', 'vetting', 'Val', 'she/her', 'About Val', 'London', '{Woman}', null, null, null),
  ('f0000000-0000-0000-0000-000000000014', 'active', 'Max', 'he/him', 'About Max', 'London', '{Man}', null, null, now()),
  ('f0000000-0000-0000-0000-000000000016', 'approved', 'Una', 'she/her', 'About Una', 'London', '{Woman}', null, null, null),
  ('f0000000-0000-0000-0000-000000000017', 'suspended', 'Sid', 'he/him', 'About Sid', 'London', '{Man}', null, null, now()),
  ('f0000000-0000-0000-0000-000000000018', 'active', 'Lou', 'they/them', 'About Lou', 'London', '{Man}', null, null, now());

-- Fay and Gil show themselves only to some genders (Gil includes women, Fay doesn't).
update public.profiles
set hide_by_gender = true,
    search_filters = jsonb_build_object('looking_for', '[]'::jsonb, 'gender', g, 'min_age', 18,
      'max_age', 70, 'show_unspecified_age', true)
from (values
  ('f0000000-0000-0000-0000-000000000006'::uuid, '["Man"]'::jsonb),
  ('f0000000-0000-0000-0000-000000000007'::uuid, '["Woman", "Man"]'::jsonb)
) as h (id, g)
where profiles.id = h.id;

do $$
begin
  perform public.connect_with_admins(id) from public.profiles where status = 'active';
end;
$$;

insert into public.connection_secrets (user_id, other_user_id, dismissed_at)
values ('f0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000008', now());

insert into public.connections (initiator_id, recipient_id, status) values
  ('f0000000-0000-0000-0000-000000000009', 'f0000000-0000-0000-0000-000000000001', 'pending'),
  ('f0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000014', 'ended'),
  ('f0000000-0000-0000-0000-000000000018', 'f0000000-0000-0000-0000-000000000001', 'accepted');

-- Who may search ------------------------------------------------------------

select ok(not has_function_privilege('authenticated', 'public.gender_filter_values(text[])', 'execute'),
  'the helper is not for clients');
select ok(not has_function_privilege('authenticated', 'public.is_hidden_by_gender(public.profiles, text[])', 'execute'),
  'nor is the one for hiding by gender');

set local role anon;
select throws_ok($$ select public.search_profiles() $$, '42501', null,
  'signed-out callers cannot search');

set local role authenticated;
set local request.jwt.claim.sub = 'f0000000-0000-0000-0000-000000000015';
select throws_ok($$ select public.search_profiles() $$, '42501', 'Only members can search.',
  'people without a profile cannot search');
set local request.jwt.claim.sub = 'f0000000-0000-0000-0000-000000000013';
select throws_ok($$ select public.search_profiles() $$, '42501', 'Only members can search.',
  'applicants cannot search');
set local request.jwt.claim.sub = 'f0000000-0000-0000-0000-000000000016';
select throws_ok($$ select public.search_profiles() $$, '42501', 'Only members can search.',
  'approved applicants cannot search before the age check');
set local request.jwt.claim.sub = 'f0000000-0000-0000-0000-000000000004';
select throws_ok($$ select public.search_profiles() $$, '42501', 'Only members can search.',
  'members who hid their profile cannot search');
set local request.jwt.claim.sub = 'f0000000-0000-0000-0000-000000000017';
select throws_ok($$ select public.search_profiles() $$, '42501', 'Only members can search.',
  'suspended members cannot search');
set local request.jwt.claim.sub = 'f0000000-0000-0000-0000-000000000005';
select throws_ok($$ select public.search_profiles() $$, '42501', 'Only members can search.',
  'deleted members cannot search');

-- Who shows up ----------------------------------------------------------------

set local request.jwt.claim.sub = 'f0000000-0000-0000-0000-000000000001';
select results_eq(
  $$ select e ->> 'name' from jsonb_array_elements(public.search_profiles()) with ordinality t (e, n) order by n $$,
  $$ values ('Jo'), ('Ben'), ('Gil'), ('Kai') $$,
  'only live members in the same location, not connected, dismissed or hiding from the caller, newest first'
);

select is(
  (select e from jsonb_array_elements(public.search_profiles()) e where e ->> 'name' = 'Jo'),
  jsonb_build_object('id', 'f0000000-0000-0000-0000-000000000010', 'name', 'Jo',
    'pronouns', 'they/them', 'tagline', '', 'bio', 'About Jo', 'location', 'london',
    'gender', '["Two-spirit"]'::jsonb, 'sexuality', '[]'::jsonb, 'looking_for', '[]'::jsonb,
    'age', 30, 'photos', '[]'::jsonb),
  'a profile has only what it shows, with the age instead of the birth date'
);

-- Gil has search settings, unlike Jo above.
select is(
  (select array_agg(distinct k order by k)
   from jsonb_array_elements(public.search_profiles()) e, jsonb_object_keys(e) k),
  array['age', 'bio', 'gender', 'id', 'location', 'looking_for', 'name', 'photos', 'pronouns',
    'sexuality', 'tagline'],
  'nobody''s search settings, status or timestamps are returned'
);

select is(
  (select e -> 'age' from jsonb_array_elements(public.search_profiles()) e where e ->> 'name' = 'Ben'),
  'null'::jsonb,
  'people who left their birthday out have no age'
);

set local request.jwt.claim.sub = 'f0000000-0000-0000-0000-000000000002';
select ok(
  (select bool_or(e ->> 'name' = 'Fay') from jsonb_array_elements(public.search_profiles()) e),
  'people hiding by gender show up for the genders they picked'
);

set local request.jwt.claim.sub = 'f0000000-0000-0000-0000-000000000008';
select ok(
  (select bool_or(e ->> 'name' = 'Amy') from jsonb_array_elements(public.search_profiles()) e),
  'being dismissed by someone does not hide them from you'
);

set local request.jwt.claim.sub = 'f0000000-0000-0000-0000-000000000003';
select is(public.search_profiles(), '[]'::jsonb, 'nobody else lives in Manchester');

-- The admin is connected with every member, like in real life, and lives in London, so they
-- see the members who don't hide from their (empty) gender. Gil and Fay do.
set local request.jwt.claim.sub = 'f0000000-0000-0000-0000-000000000012';
select results_eq(
  $$ select e ->> 'name' from jsonb_array_elements(public.search_profiles()) with ordinality t (e, n) order by n $$,
  $$ values ('Hal'), ('Ivy'), ('Max'), ('Lou'), ('Jo'), ('Ben'), ('Kai'), ('Amy') $$,
  'admins can browse, though they are connected with everyone'
);

-- Age -------------------------------------------------------------------------

-- Jo turns 30 this month, rather than last month.
reset role;
update public.profiles
set birth_year = extract(year from now() - interval '30 years'),
    birth_month = extract(month from now())
where id = 'f0000000-0000-0000-0000-000000000010';

set local role authenticated;
set local request.jwt.claim.sub = 'f0000000-0000-0000-0000-000000000001';
select is(
  (select (e ->> 'age')::int from jsonb_array_elements(public.search_profiles()) e where e ->> 'name' = 'Jo'),
  29,
  'the birthday counts only once the birth month is over'
);

-- Hiding by gender ------------------------------------------------------------------

reset role;
update public.profiles
set hide_by_gender = true,
    search_filters = '{"looking_for": [], "gender": ["Woman", "self-described"], "min_age": 18, "max_age": 70, "show_unspecified_age": true}'
where id = 'f0000000-0000-0000-0000-000000000001';

set local role authenticated;
set local request.jwt.claim.sub = 'f0000000-0000-0000-0000-000000000001';
select results_eq(
  $$ select e ->> 'name' from jsonb_array_elements(public.search_profiles()) with ordinality t (e, n) order by n $$,
  $$ values ('Jo'), ('Ben'), ('Gil'), ('Kai') $$,
  'hiding by gender does not narrow your own results (the app applies your Gender filter)'
);

set local request.jwt.claim.sub = 'f0000000-0000-0000-0000-000000000002';
select ok(
  not (select coalesce(bool_or(e ->> 'name' = 'Amy'), false) from jsonb_array_elements(public.search_profiles()) e),
  'and the genders they hide from do not see them'
);

set local request.jwt.claim.sub = 'f0000000-0000-0000-0000-000000000011';
select ok(
  not (select coalesce(bool_or(e ->> 'name' = 'Amy'), false) from jsonb_array_elements(public.search_profiles()) e),
  'an empty gender counts as not specified'
);

set local request.jwt.claim.sub = 'f0000000-0000-0000-0000-000000000010';
select ok(
  (select bool_or(e ->> 'name' = 'Amy') from jsonb_array_elements(public.search_profiles()) e),
  'a gender of their own counts as self-described'
);

-- Ben is a man and a woman for this one.
reset role;
update public.profiles set gender = '{Man,Woman}' where id = 'f0000000-0000-0000-0000-000000000002';

set local role authenticated;
set local request.jwt.claim.sub = 'f0000000-0000-0000-0000-000000000002';
select ok(
  (select bool_or(e ->> 'name' = 'Amy') from jsonb_array_elements(public.search_profiles()) e),
  'one matching gender is enough'
);

reset role;
update public.profiles set gender = '{Man}' where id = 'f0000000-0000-0000-0000-000000000002';

-- Amy keeps the filter, but turns the switch off.
set local role authenticated;
set local request.jwt.claim.sub = 'f0000000-0000-0000-0000-000000000001';
select lives_ok(
  $$ select public.set_search_filters('{"looking_for": [], "gender": ["Woman"], "min_age": 18, "max_age": 70, "show_unspecified_age": true}', false) $$,
  'Amy turns the switch off');

set local request.jwt.claim.sub = 'f0000000-0000-0000-0000-000000000002';
select ok(
  (select bool_or(e ->> 'name' = 'Amy') from jsonb_array_elements(public.search_profiles()) e),
  'a Gender filter on its own hides nobody'
);

set local request.jwt.claim.sub = 'f0000000-0000-0000-0000-000000000001';
select lives_ok(
  $$ select public.set_search_filters('{"looking_for": [], "gender": ["not-specified"], "min_age": 18, "max_age": 70, "show_unspecified_age": true}', true) $$,
  'Amy shows herself only to people who gave no gender');

set local request.jwt.claim.sub = 'f0000000-0000-0000-0000-000000000011';
select ok(
  (select bool_or(e ->> 'name' = 'Amy') from jsonb_array_elements(public.search_profiles()) e),
  'people who gave no gender see those who picked Not specified'
);

-- Dismissing ------------------------------------------------------------------------

set local request.jwt.claim.sub = 'f0000000-0000-0000-0000-000000000001';
select lives_ok(
  $$ select public.set_dismissed('f0000000-0000-0000-0000-000000000008', false) $$,
  'Amy undoes dismissing Hal');
select ok(
  (select bool_or(e ->> 'name' = 'Hal') from jsonb_array_elements(public.search_profiles()) e),
  'undoing a dismissal brings them back'
);

set local request.jwt.claim.sub = 'f0000000-0000-0000-0000-000000000012';
select lives_ok(
  $$ select public.set_dismissed('f0000000-0000-0000-0000-000000000008', true) $$,
  'the admin dismisses Hal');
select ok(
  not (select coalesce(bool_or(e ->> 'name' = 'Hal'), false) from jsonb_array_elements(public.search_profiles()) e),
  'dismissing works for admins too'
);

select * from finish();
rollback;
