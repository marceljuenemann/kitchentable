begin;
select plan(4);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'hal@example.com', '{}'::jsonb, '', now(), now(), now()),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'ida@example.com', '{}'::jsonb, '', now(), now(), now()),
  ('bbbbbbbb-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'jo@example.com', '{}'::jsonb, '', now(), now(), now());

insert into public.terms_acceptances (user_id, version) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 1),
  ('bbbbbbbb-0000-0000-0000-000000000002', 1),
  ('bbbbbbbb-0000-0000-0000-000000000003', 1);

-- Requests to this URL are the ones made by this test (pg_net only sends them after commit, and
-- the test is rolled back, so none are sent).
create function pg_temp.requests() returns setof net.http_request_queue language sql as $$
  select * from net.http_request_queue where url = 'http://notify.test/'
$$;

-- Without the vault secrets (as on a fresh environment), an application still goes through.
delete from vault.secrets where name in ('notify_admin_url', 'notify_admin_secret');
select lives_ok(
  $$ insert into public.profiles (id, name, pronouns, bio, location)
     values ('bbbbbbbb-0000-0000-0000-000000000001', 'Hal', 'he/him', 'About Hal', 'London') $$,
  'an application is saved even when the admin cannot be notified'
);

select vault.create_secret('http://notify.test/', 'notify_admin_url');
select vault.create_secret('test-secret', 'notify_admin_secret');

insert into public.profiles (id, name, pronouns, bio, location)
values ('bbbbbbbb-0000-0000-0000-000000000002', 'Ida', 'she/her', 'About Ida', 'London');

select is((select count(*) from pg_temp.requests()), 1::bigint, 'a new application notifies the admin');
select is(
  (select headers ->> 'x-notify-admin-secret' from pg_temp.requests()),
  'test-secret',
  'the request carries the shared secret'
);

insert into public.profiles (id, status, name, pronouns, bio, location)
values ('bbbbbbbb-0000-0000-0000-000000000003', 'active', 'Jo', 'they/them', 'About Jo', 'London');
select is((select count(*) from pg_temp.requests()), 1::bigint,
  'a profile created in another status (by an admin or a fixture) notifies no one');

select * from finish();
rollback;
