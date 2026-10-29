begin;
select plan(9);

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

set local role anon;
select throws_ok($$ select public.set_visible_to_genders('{Woman}') $$, '42501', null,
  'signed-out callers cannot set it');

set local role authenticated;
set local request.jwt.claim.sub = 'e0000000-0000-0000-0000-000000000001';

select lives_ok($$ select public.set_visible_to_genders('{Woman,not-specified,Non-binary,Woman}') $$,
  'a member can limit who sees them');
select ok(
  (select visible_to_genders @> '{Non-binary,Woman,not-specified}' and cardinality(visible_to_genders) = 3
   from public.profiles where id = 'e0000000-0000-0000-0000-000000000001'),
  'the values are stored without duplicates'
);

select throws_ok($$ select public.set_visible_to_genders('{Woman,Martian}') $$, 'P0001',
  'Unknown gender filter value.', 'values that are not Gender filter values are rejected');
select ok(
  (select cardinality(visible_to_genders) = 3
   from public.profiles where id = 'e0000000-0000-0000-0000-000000000001'),
  'a rejected call changes nothing'
);

select lives_ok($$ select public.set_visible_to_genders('{}') $$, 'an empty list turns it off');
select is(
  (select visible_to_genders from public.profiles where id = 'e0000000-0000-0000-0000-000000000001'),
  null::text[],
  'off is stored as null'
);

set local request.jwt.claim.sub = 'e0000000-0000-0000-0000-000000000002';
select throws_ok($$ select public.set_visible_to_genders('{Woman}') $$, 'P0001',
  'There is no profile.', 'someone without a profile cannot set it');

reset role;
select throws_ok(
  $$ update public.profiles set visible_to_genders = '{}' where id = 'e0000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'an empty list is never stored'
);

select * from finish();
rollback;
