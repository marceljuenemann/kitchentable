begin;
select plan(11);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'gale@example.com', '{}'::jsonb, '', now(), now(), now());

set local role anon;
select throws_ok($$ select public.track_event('onboarding_step_viewed') $$, '42501', null,
  'signed-out callers cannot record events');

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select throws_ok($$ select public.track_event('profile_viewed') $$, 'P0001', 'Unknown event.',
  'an event name not on the list is rejected');
select throws_ok($$ select public.track_event(null) $$, 'P0001', 'Unknown event.',
  'a missing event name is rejected');
select throws_ok($$ select public.track_event('onboarding_step_viewed', '[1]') $$, 'P0001',
  'Event properties must be a small JSON object.', 'properties that are not an object are rejected');
select throws_ok(
  $$ select public.track_event('onboarding_step_viewed', jsonb_build_object('x', repeat('x', 500))) $$,
  'P0001', 'Event properties must be a small JSON object.', 'large properties are rejected');

select lives_ok($$ select public.track_event('onboarding_step_viewed', '{"step": 2}') $$,
  'a listed event is recorded');
select lives_ok($$ select public.track_event('onboarding_step_viewed') $$,
  'properties are optional');

select throws_ok($$ select * from public.analytics_events $$, '42501', null,
  'signed-in users cannot read events');
select throws_ok(
  $$ insert into public.analytics_events (user_id, name) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'x') $$,
  '42501', null, 'signed-in users cannot write events directly');

reset role;
select results_eq(
  $$ select user_id, name, props from public.analytics_events
     where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' order by id $$,
  $$ values
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'onboarding_step_viewed', '{"step": 2}'::jsonb),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'onboarding_step_viewed', null::jsonb) $$,
  'events are stored for the caller'
);

-- Run the scheduled purge: events older than 3 months go, the rest stay.
update public.analytics_events set created_at = now() - interval '3 months 1 day'
where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and props is null;
do $$ begin execute (select command from cron.job where jobname = 'purge-analytics-events'); end $$;
select results_eq(
  $$ select props from public.analytics_events where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  $$ values ('{"step": 2}'::jsonb) $$,
  'the daily purge deletes events older than 3 months'
);

select * from finish();
rollback;
