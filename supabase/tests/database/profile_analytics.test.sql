begin;
select plan(10);

-- Rae is a live member, Sol an admin.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, encrypted_password, email_confirmed_at, created_at, updated_at)
select id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  email, '{}'::jsonb, '', now(), now(), now()
from (values
  ('d1000000-0000-0000-0000-000000000001', 'rae@example.com'),
  ('d1000000-0000-0000-0000-000000000002', 'sol@example.com')
) as u (id, email);

insert into public.terms_acceptances (user_id, version)
select id, 1 from auth.users where id::text like 'd1000000-%';

insert into public.profiles (id, status, name, pronouns, bio, location)
values
  ('d1000000-0000-0000-0000-000000000001', 'approved', 'Rae', 'she/her', 'About Rae', 'London'),
  ('d1000000-0000-0000-0000-000000000002', 'admin', 'Sol', 'they/them', 'About Sol', 'London');

-- Rae's profile_changed events, oldest first, as {fields, by}.
create function pg_temp.rae_changes() returns jsonb language sql as $$
  select coalesce(jsonb_agg(props order by id), '[]')
  from public.analytics_events
  where user_id = 'd1000000-0000-0000-0000-000000000001' and name = 'profile_changed';
$$;

set local role authenticated;
set local request.jwt.claim.sub = 'd1000000-0000-0000-0000-000000000001';

select lives_ok($$ select public.track_event('invite_link_shared', '{"method": "copy"}') $$,
  'invite_link_shared can be recorded');
select lives_ok($$ select public.track_event('photo_rejected', '{"reason": "too_small"}') $$,
  'photo_rejected can be recorded');
select lives_ok($$ select public.track_event('profile_preview_opened') $$,
  'profile_preview_opened can be recorded');
select throws_ok($$ select public.track_event('profile_changed', '{"fields": ["name"], "by": "self"}') $$,
  'P0001', 'Unknown event.', 'members cannot record profile_changed themselves');

-- The Didit webhook makes the profile live (no signed-in user).
reset role;
set local request.jwt.claim.sub = '';
update public.profiles set status = 'active', age_verified_at = now()
where id = 'd1000000-0000-0000-0000-000000000001';
select is(pg_temp.rae_changes(),
  '[{"fields": ["age_verified_at", "status"], "by": "system"}]'::jsonb,
  'a change without a signed-in user is recorded as by the system, with the fields that changed');

-- Rae saves her search filters.
set local role authenticated;
set local request.jwt.claim.sub = 'd1000000-0000-0000-0000-000000000001';
select public.set_search_filters(
  '{"looking_for": [], "gender": ["Woman"], "min_age": 18, "max_age": 70, "show_unspecified_age": true}', true);
reset role;
select is(pg_temp.rae_changes() -> 1,
  '{"fields": ["hide_by_gender", "search_filters"], "by": "self"}'::jsonb,
  'the owner''s own changes are recorded as by themselves');

-- Sol, an admin, changes Rae's profile.
reset role;
set local request.jwt.claim.sub = 'd1000000-0000-0000-0000-000000000002';
update public.profiles set status = 'suspended' where id = 'd1000000-0000-0000-0000-000000000001';
select is(pg_temp.rae_changes() -> 2, '{"fields": ["status"], "by": "admin"}'::jsonb,
  'an admin''s change is recorded as by an admin, on the profile that changed');
select is(
  (select count(*) from public.analytics_events
   where user_id = 'd1000000-0000-0000-0000-000000000002' and name = 'profile_changed'),
  0::bigint, 'nothing is recorded for the admin who made the change');

-- Neither the notification emails' bookkeeping nor an update that changes nothing counts.
set local request.jwt.claim.sub = '';
update public.profiles set intros_emailed_at = now(), messages_emailed_at = now()
where id = 'd1000000-0000-0000-0000-000000000001';
select is(jsonb_array_length(pg_temp.rae_changes()), 3, 'email bookkeeping is not a change');
update public.profiles set name = name where id = 'd1000000-0000-0000-0000-000000000001';
select is(jsonb_array_length(pg_temp.rae_changes()), 3, 'an update that changes nothing is not a change');

select * from finish();
rollback;
