begin;
select plan(4);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'carol@example.com', '{"invite_code":"PROFILE-TEST"}'::jsonb, '', now(), now(), now()),
  ('66666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'dave@example.com', '{"invite_code":"PROFILE-TEST"}'::jsonb, '', now(), now(), now());

insert into public.terms_acceptances (user_id, version) values
  ('55555555-5555-5555-5555-555555555555', 1),
  ('66666666-6666-6666-6666-666666666666', 1);

insert into public.profiles (id, name, pronouns, bio, location, status, photos) values
  ('55555555-5555-5555-5555-555555555555', 'Carol', 'she/her', 'About Carol', 'London', 'active',
    array['aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001']::uuid[]),
  ('66666666-6666-6666-6666-666666666666', 'Dave', 'he/him', 'About Dave', 'London', 'vetting', '{}');

set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';

select is(public.get_my_profile() ->> 'name', 'Carol', 'returns the caller''s own profile, not another user''s');
select is(public.get_my_profile() ->> 'status', 'active', 'includes the status');
select is(
  public.get_my_profile() -> 'photos',
  '["aaaaaaaa-0000-0000-0000-000000000002", "aaaaaaaa-0000-0000-0000-000000000001"]'::jsonb,
  'includes the photo ids in their stored (display) order'
);

set local request.jwt.claim.sub = '77777777-7777-7777-7777-777777777777';
select is(public.get_my_profile(), null, 'null for a user without a profile row');

select * from finish();
rollback;
