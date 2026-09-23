begin;
select plan(4);

insert into public.invite_codes (code, max_uses) values ('PROFILE-TEST', 2);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'carol@example.com', '{"invite_code":"PROFILE-TEST"}'::jsonb, '', now(), now(), now()),
  ('66666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'dave@example.com', '{"invite_code":"PROFILE-TEST"}'::jsonb, '', now(), now(), now());

insert into public.profiles (id, name, status) values
  ('55555555-5555-5555-5555-555555555555', 'Carol', 'active'),
  ('66666666-6666-6666-6666-666666666666', 'Dave', 'vetting');
insert into public.profile_photos (profile_id, storage_path, position) values
  ('55555555-5555-5555-5555-555555555555', '55555555-5555-5555-5555-555555555555/b.jpg', 1),
  ('55555555-5555-5555-5555-555555555555', '55555555-5555-5555-5555-555555555555/a.jpg', 0);

set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';

select is(public.get_my_profile() ->> 'name', 'Carol', 'returns the caller''s own profile, not another user''s');
select is(public.get_my_profile() ->> 'status', 'active', 'includes the status');
select is(
  (select array_agg(p ->> 'storage_path') from jsonb_array_elements(public.get_my_profile() -> 'photos') p),
  array['55555555-5555-5555-5555-555555555555/a.jpg', '55555555-5555-5555-5555-555555555555/b.jpg'],
  'includes photos ordered by position'
);

set local request.jwt.claim.sub = '77777777-7777-7777-7777-777777777777';
select is(public.get_my_profile(), null, 'null for a user without a profile row');

select * from finish();
rollback;
