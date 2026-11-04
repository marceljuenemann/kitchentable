begin;
select plan(15);

-- The back-off --------------------------------------------------------------

select ok(public.email_notification_due(null, now() - interval '1 day', now() - interval '20 minutes'),
  'the first email goes out once something has waited 15 minutes');
select ok(not public.email_notification_due(null, now() - interval '1 day', now() - interval '10 minutes'),
  'nothing is sent about something newer than 15 minutes');
select ok(public.email_notification_due(now() - interval '2 hours', now() - interval '1 hour', now() - interval '20 minutes'),
  'after reading anything since the last email, the next one only waits the 15 minutes');
select ok(not public.email_notification_due(now() - interval '12 hours', now() - interval '13 hours', now() - interval '20 minutes'),
  'otherwise the next email waits at least a day');
select ok(public.email_notification_due(now() - interval '25 hours', now() - interval '26 hours', now() - interval '20 minutes'),
  'and goes out after a day');
select ok(not public.email_notification_due(now() - interval '3 days', now() - interval '7 days', now() - interval '20 minutes'),
  'someone who had been away 4 days when emailed waits 4 more');
select ok(public.email_notification_due(now() - interval '4 days', now() - interval '8 days', now() - interval '20 minutes'),
  'and is emailed after them');
select ok(not public.email_notification_due(now() - interval '13 days', now() - interval '100 days', now() - interval '20 minutes'),
  'the wait grows up to 14 days');
select ok(public.email_notification_due(now() - interval '14 days', now() - interval '100 days', now() - interval '20 minutes'),
  'and no further');

-- Who gets which ------------------------------------------------------------

-- Ada is an admin, Eve has hidden her profile, the others are live members. Fay has switched off
-- the intro emails and Kim the message emails.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, encrypted_password, email_confirmed_at, created_at, updated_at)
select id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  email, '{}'::jsonb, '', now(), now(), now()
from (values
  ('f0000000-0000-0000-0000-000000000001', 'ada@example.com'),
  ('f0000000-0000-0000-0000-000000000002', 'amy@example.com'),
  ('f0000000-0000-0000-0000-000000000003', 'ben@example.com'),
  ('f0000000-0000-0000-0000-000000000004', 'cat@example.com'),
  ('f0000000-0000-0000-0000-000000000005', 'dan@example.com'),
  ('f0000000-0000-0000-0000-000000000006', 'eve@example.com'),
  ('f0000000-0000-0000-0000-000000000007', 'fay@example.com'),
  ('f0000000-0000-0000-0000-000000000008', 'gus@example.com'),
  ('f0000000-0000-0000-0000-000000000009', 'hal@example.com'),
  ('f0000000-0000-0000-0000-000000000010', 'ivy@example.com'),
  ('f0000000-0000-0000-0000-000000000011', 'una@example.com'),
  ('f0000000-0000-0000-0000-000000000012', 'kim@example.com')
) as u (id, email);

insert into public.terms_acceptances (user_id, version)
select id, 1 from auth.users where id::text like 'f0000000-%';

-- Created long ago, so nobody counts as having read anything recently.
insert into public.profiles (id, status, name, pronouns, bio, location, looking_for, created_at)
select id::uuid, status::public.profile_status, name, '-', '-', 'London',
  case when status = 'admin' then '{}'::text[] else '{friends}' end, now() - interval '1 year'
from (values
  ('f0000000-0000-0000-0000-000000000001', 'admin', 'Ada'),
  ('f0000000-0000-0000-0000-000000000002', 'active', 'Amy'),
  ('f0000000-0000-0000-0000-000000000003', 'active', 'Ben'),
  ('f0000000-0000-0000-0000-000000000004', 'active', 'Cat'),
  ('f0000000-0000-0000-0000-000000000005', 'active', 'Dan'),
  ('f0000000-0000-0000-0000-000000000006', 'disabled', 'Eve'),
  ('f0000000-0000-0000-0000-000000000007', 'active', 'Fay'),
  ('f0000000-0000-0000-0000-000000000008', 'active', 'Gus'),
  ('f0000000-0000-0000-0000-000000000009', 'active', 'Hal'),
  ('f0000000-0000-0000-0000-000000000010', 'active', 'Ivy'),
  ('f0000000-0000-0000-0000-000000000011', 'active', 'Una'),
  ('f0000000-0000-0000-0000-000000000012', 'active', 'Kim')
) as p (id, status, name);

update public.profiles set intro_emails = false where name = 'Fay' and id::text like 'f0000000-%';
update public.profiles set message_emails = false where name = 'Kim' and id::text like 'f0000000-%';

-- Connections by name: who started it, with whom, the status, when it last changed and the
-- looking_for (empty for the admin's), each side's read watermark and decline, and the messages.
create function pg_temp.id(p_name text) returns uuid language sql as $$
  select id from public.profiles where name = p_name and id::text like 'f0000000-%'
$$;
create function pg_temp.connect(
  p_from text, p_to text, p_status public.connection_status, p_changed interval,
  p_from_read interval, p_to_read interval, p_declined boolean default false
) returns void language sql as $$
  insert into public.connections (initiator_id, recipient_id, status, looking_for, created_at, updated_at)
  values (pg_temp.id(p_from), pg_temp.id(p_to), p_status,
    case when p_from = 'Ada' then '{}'::text[] else '{friends}' end, now() - p_changed, now() - p_changed);
  insert into public.connection_secrets (user_id, other_user_id, last_read_at, declined_at) values
    (pg_temp.id(p_from), pg_temp.id(p_to), now() - p_from_read, null),
    (pg_temp.id(p_to), pg_temp.id(p_from), now() - p_to_read,
      case when p_declined then now() - p_changed end);
$$;
create function pg_temp.message(p_from text, p_to text, p_ago interval) returns void language sql as $$
  insert into public.messages (sender_id, recipient_id, content, created_at)
  values (pg_temp.id(p_from), pg_temp.id(p_to), '{"type": "text", "text": "Hi"}', now() - p_ago);
$$;

-- Intros from Ben: to Amy 20 minutes ago (emailed), Cat 5 minutes ago (too new), Dan (declined),
-- Eve (hidden profile) and Fay (switched off).
select pg_temp.connect('Ben', 'Amy', 'pending', '20 minutes', null, null);
select pg_temp.connect('Ben', 'Cat', 'pending', '5 minutes', null, null);
select pg_temp.connect('Ben', 'Dan', 'pending', '1 hour', null, null, true);
select pg_temp.connect('Ben', 'Eve', 'pending', '1 hour', null, null);
select pg_temp.connect('Ben', 'Fay', 'pending', '1 hour', null, null);

-- Amy accepted Cat's intro an hour ago, which Cat hasn't opened yet (emailed).
select pg_temp.connect('Cat', 'Amy', 'accepted', '1 hour', null, '2 hours');
select pg_temp.message('Cat', 'Amy', '3 hours');
-- Hal wrote to Amy 20 minutes ago (emailed); Hal has read everything.
select pg_temp.connect('Hal', 'Amy', 'accepted', '1 day', '1 day', '1 day');
select pg_temp.message('Hal', 'Amy', '20 minutes');
-- Hal ended things with Dan, after a message Dan never read.
select pg_temp.connect('Hal', 'Dan', 'ended', '20 minutes', '1 hour', null);
select pg_temp.message('Hal', 'Dan', '30 minutes');
-- Ada welcomed Gus (emailed); the admin gets no "accepted intro" email for it.
select pg_temp.connect('Ada', 'Gus', 'accepted', '1 hour', null, null);
select pg_temp.message('Ada', 'Gus', '20 minutes');
-- Ivy has read Una's message.
select pg_temp.connect('Una', 'Ivy', 'accepted', '2 hours', '1 hour', '1 hour');
select pg_temp.message('Una', 'Ivy', '90 minutes');
-- Kim hasn't read Ben's intro, but has switched message emails off.
select pg_temp.connect('Ben', 'Kim', 'accepted', '1 hour', '1 hour', null);
select pg_temp.message('Ben', 'Kim', '2 hours');

-- Requests to this URL are the ones made by this test (pg_net only sends them after commit, and
-- the test is rolled back, so none are sent). Only to this test's users: the local database has
-- others, from the e2e tests.
delete from vault.secrets where name in ('send_email_url', 'send_email_secret');
select vault.create_secret('http://send-email.test/', 'send_email_url');
select vault.create_secret('test-secret', 'send_email_secret');
create function pg_temp.sent() returns text[] language sql as $$
  select coalesce(array_agg(convert_from(q.body, 'utf8')::jsonb ->> 'template' || ' to ' || p.name order by q.id), '{}')
  from net.http_request_queue q
  join public.profiles p on p.id = (convert_from(q.body, 'utf8')::jsonb ->> 'user_id')::uuid
  where q.url = 'http://send-email.test/' and p.id::text like 'f0000000-%'
$$;

select public.send_email_notifications();
select is(
  pg_temp.sent(),
  array['new_intros to Amy', 'new_messages to Amy', 'new_messages to Cat', 'new_messages to Gus'],
  'emails go out for new intros, unread messages and accepted intros, and not for anything else'
);
select is(
  (select row(intros_emailed_at, messages_emailed_at)::text from public.profiles where id = pg_temp.id('Amy')),
  row(now(), now())::text,
  'when each kind was emailed is noted'
);

select public.send_email_notifications();
select is(cardinality(pg_temp.sent()), 4, 'nothing is emailed twice');

-- Amy was emailed about intros an hour ago, without reading anything since (last 2 hours ago).
update public.profiles set intros_emailed_at = now() - interval '1 hour' where id = pg_temp.id('Amy');
select pg_temp.connect('Una', 'Amy', 'pending', '30 minutes', null, null);
select public.send_email_notifications();
select is(cardinality(pg_temp.sent()), 4, 'a new intro waits while the emails back off');

-- Once she has read something since that email, the next one goes out.
update public.connection_secrets set last_read_at = now() - interval '45 minutes'
where user_id = pg_temp.id('Amy') and other_user_id = pg_temp.id('Hal');
select public.send_email_notifications();
select is((pg_temp.sent())[5], 'new_intros to Amy', 'and goes out once the user has read anything since');

set local role authenticated;
select throws_ok($$ select public.send_email_notifications() $$, '42501', null,
  'clients cannot send the emails');

select * from finish();
rollback;
