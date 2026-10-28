begin;
select plan(8);

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
  select * from net.http_request_queue where url = 'http://send-email.test/' order by id
$$;

-- Without the vault secrets (as on a fresh environment), an application still goes through.
delete from vault.secrets where name in ('send_email_url', 'send_email_secret');
select lives_ok(
  $$ insert into public.profiles (id, name, pronouns, bio, location)
     values ('bbbbbbbb-0000-0000-0000-000000000001', 'Hal', 'he/him', 'About Hal', 'London') $$,
  'an application is saved even when no email can be sent'
);

select vault.create_secret('http://send-email.test/', 'send_email_url');
select vault.create_secret('test-secret', 'send_email_secret');

-- A new application -----------------------------------------------------

insert into public.profiles (id, name, pronouns, bio, location)
values ('bbbbbbbb-0000-0000-0000-000000000002', 'Ida', 'she/her', 'About Ida', 'London');

select is(
  (select array_agg(convert_from(body, 'utf8')::jsonb) from pg_temp.requests()),
  array['{"template": "application_submitted"}'::jsonb],
  'a new application emails the admin, with no personal data'
);
select is(
  (select headers ->> 'x-send-email-secret' from pg_temp.requests() limit 1),
  'test-secret',
  'the request carries the shared secret'
);

insert into public.profiles (id, status, name, pronouns, bio, location)
values ('bbbbbbbb-0000-0000-0000-000000000003', 'active', 'Jo', 'they/them', 'About Jo', 'London');
select is((select count(*) from pg_temp.requests()), 1::bigint,
  'a profile created in another status (by an admin or a fixture) emails no one');

-- Approval --------------------------------------------------------------

update public.profiles set bio = 'More about Ida' where id = 'bbbbbbbb-0000-0000-0000-000000000002';
select is((select count(*) from pg_temp.requests()), 1::bigint,
  'other changes to an application email no one');

update public.profiles set status = 'approved' where id = 'bbbbbbbb-0000-0000-0000-000000000002';
select is(
  (select convert_from(body, 'utf8')::jsonb from pg_temp.requests() offset 1),
  '{"template": "application_approved", "user_id": "bbbbbbbb-0000-0000-0000-000000000002"}'::jsonb,
  'an approval emails the applicant, by user id'
);

update public.profiles set status = 'active' where id = 'bbbbbbbb-0000-0000-0000-000000000002';
update public.profiles set status = 'approved' where id = 'bbbbbbbb-0000-0000-0000-000000000003';
select is((select count(*) from pg_temp.requests()), 2::bigint,
  'only the move from vetting to approved emails the member');

-- Clients can't send emails themselves.
set local role authenticated;
select throws_ok($$ select public.send_email('application_approved', 'bbbbbbbb-0000-0000-0000-000000000003') $$,
  '42501', null, 'users cannot call send_email');

select * from finish();
rollback;
