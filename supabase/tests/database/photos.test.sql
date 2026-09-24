begin;
select plan(5);

insert into public.invite_codes (code, max_uses) values ('PHOTOS-TEST', 2);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('88888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'erin@example.com', '{"invite_code":"PHOTOS-TEST"}'::jsonb, '', now(), now(), now());

insert into public.profiles (id) values ('88888888-8888-8888-8888-888888888888');

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

select * from finish();
rollback;
