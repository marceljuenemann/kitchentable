begin;
select plan(6);

insert into public.invite_codes (code, max_uses) values ('SUBMIT-TEST', 5);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'applicant@example.com', '{"invite_code":"SUBMIT-TEST"}'::jsonb, '', now(), now(), now());

select throws_ok(
  $$ update public.profiles set application_status = 'pending' where id = '22222222-2222-2222-2222-222222222222' $$,
  'P0001',
  'name is required before submitting',
  'an empty draft cannot be submitted'
);

update public.profiles set
  name = 'Test User',
  tagline = 'Tagline',
  bio = 'Bio text',
  location = 'London',
  application_consent_answer = 'Consent answer',
  application_enm_answer = 'ENM answer',
  gender = array['woman'],
  sexuality = array['bisexual']
where id = '22222222-2222-2222-2222-222222222222';

select throws_ok(
  $$ update public.profiles set application_status = 'pending' where id = '22222222-2222-2222-2222-222222222222' $$,
  'P0001',
  'at least one photo is required before submitting',
  'a draft without a photo cannot be submitted, even once every other field is filled in'
);

insert into public.profile_photos (profile_id, storage_path)
values ('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222/photo.jpg');

select lives_ok(
  $$ update public.profiles set application_status = 'pending' where id = '22222222-2222-2222-2222-222222222222' $$,
  'a complete draft can be submitted'
);

select is(
  (select application_status from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  'pending',
  'status is pending after a successful submission'
);

select isnt(
  (select application_submitted_at from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  null,
  'application_submitted_at is set on submission'
);

update public.profiles set application_status = 'rejected' where id = '22222222-2222-2222-2222-222222222222';

select lives_ok(
  $$ update public.profiles set application_status = 'pending' where id = '22222222-2222-2222-2222-222222222222' $$,
  'a rejected application can be edited and resubmitted'
);

select * from finish();
rollback;
