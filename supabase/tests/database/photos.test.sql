begin;
select plan(15);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('88888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'erin@example.com', '{"invite_code":"PHOTOS-TEST"}'::jsonb, '', now(), now(), now());

insert into public.terms_acceptances (user_id, version)
values ('88888888-8888-8888-8888-888888888888', 1);

insert into public.profiles (id, name, pronouns, bio, location)
values ('88888888-8888-8888-8888-888888888888', 'Erin', 'they/them', 'About Erin', 'London');

select is(
  (select photos from public.profiles where id = '88888888-8888-8888-8888-888888888888'),
  '{}'::uuid[],
  'a profile starts with no photos'
);

select lives_ok(
  $$ update public.profiles
     set photos = array(select gen_random_uuid() from generate_series(1, 6))
     where id = '88888888-8888-8888-8888-888888888888' $$,
  'a profile can have six photos'
);

select throws_ok(
  $$ update public.profiles
     set photos = array(select gen_random_uuid() from generate_series(1, 7))
     where id = '88888888-8888-8888-8888-888888888888' $$,
  '23514',
  null,
  'a profile cannot have more than six photos'
);

select is(
  (select file_size_limit from storage.buckets where id = 'photos'),
  2097152::bigint,
  'the photos bucket limits files to 2 MiB'
);

select is(
  (select allowed_mime_types from storage.buckets where id = 'photos'),
  array['image/jpeg'],
  'the photos bucket only accepts JPEG'
);

-- Who sees whose photos -------------------------------------------------------

-- Ann and Bob are live members, Cas hid their profile, Dee is suspended and Val is being vetted.
-- Each has one photo on their profile (…a) and one that isn't (…b).
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, encrypted_password, email_confirmed_at, created_at, updated_at)
select ('e0000000-0000-0000-0000-00000000000' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'member' || n || '@example.com', '{}'::jsonb, '', now(), now(), now()
from generate_series(1, 5) n;

insert into public.terms_acceptances (user_id, version)
select id, 1 from auth.users where id::text like 'e0000000-%';

insert into public.profiles (id, status, name, pronouns, bio, location, photos)
select ('e0000000-0000-0000-0000-00000000000' || n)::uuid, status::public.profile_status, name, 'they/them', 'About them', 'London',
  array[('a0000000-0000-0000-0000-00000000000' || n)::uuid]
from (values
  (1, 'active', 'Ann'),
  (2, 'active', 'Bob'),
  (3, 'disabled', 'Cas'),
  (4, 'suspended', 'Dee'),
  (5, 'vetting', 'Val')
) as p (n, status, name);

insert into storage.objects (bucket_id, name)
select 'photos', 'e0000000-0000-0000-0000-00000000000' || n || '/' || photo || n || '/' || version || '.jpg'
from generate_series(1, 5) n,
  (values ('a0000000-0000-0000-0000-00000000000'), ('b0000000-0000-0000-0000-00000000000')) as p (photo),
  (values ('full'), ('thumb')) as v (version);

set local role authenticated;
set local request.jwt.claim.sub = 'e0000000-0000-0000-0000-000000000001';

-- The Storage API sets this for each request. e2e/search.spec.ts tests the real thing.
set local storage.operation = 'storage.object.sign_many';

select is(
  (select count(*)::int from storage.objects where name like 'e0000000-0000-0000-0000-000000000002/%'),
  2,
  'members see both versions of the photos on a live member''s profile, and not the others'
);
select is(
  (select count(*)::int from storage.objects where name like 'e0000000-0000-0000-0000-000000000001/%'),
  4,
  'members still see all of their own'
);
select is(
  (select count(*)::int from storage.objects where name ~ '^e0000000-0000-0000-0000-00000000000[345]/'),
  0,
  'nobody sees the photos of hidden, suspended or vetting profiles'
);

set local storage.operation = 'storage.object.list';
select is(
  (select count(*)::int from storage.objects where name like 'e0000000-0000-0000-0000-000000000002/%'),
  0,
  'members cannot list each other''s photos'
);
select is(
  (select count(*)::int from storage.objects where name like 'e0000000-0000-0000-0000-000000000001/%'),
  4,
  'but can list their own'
);

set local storage.operation = 'storage.object.get_authenticated';
select is(
  (select count(*)::int from storage.objects where name like 'e0000000-0000-0000-0000-000000000002/%'),
  0,
  'and nothing but signing works, so a new way of listing does not open them up'
);

set local storage.operation = 'storage.object.sign_many';
set local request.jwt.claim.sub = 'e0000000-0000-0000-0000-000000000003';
select is(
  (select count(*)::int from storage.objects where name like 'e0000000-0000-0000-0000-000000000002/%'),
  0,
  'members who hid their profile do not see other members'' photos'
);

set local request.jwt.claim.sub = 'e0000000-0000-0000-0000-000000000005';
select is(
  (select count(*)::int from storage.objects where name like 'e0000000-0000-0000-0000-000000000002/%'),
  0,
  'applicants do not see members'' photos'
);

reset role;
set local role anon;
select is(
  (select count(*)::int from storage.objects where name like 'e0000000-0000-0000-0000-000000000002/%'),
  0,
  'signed-out visitors see no photos'
);

reset role;
select ok(not has_function_privilege('anon', 'public.is_member_photo(text)', 'execute'),
  'the policy''s helper is not for signed-out callers');

select * from finish();
rollback;
