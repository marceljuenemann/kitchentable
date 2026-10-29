begin;
select plan(83);

-- Ada is an admin. Amy, Ben, Cat, Dan and Hal are live members, Eve has hidden her profile, Fay
-- has deleted hers, and Gil is approved and waiting for his age check.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, encrypted_password, email_confirmed_at, created_at, updated_at)
select id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  email, '{}'::jsonb, '', now(), now(), now()
from (values
  ('d0000000-0000-0000-0000-000000000001', 'ada@example.com'),
  ('d0000000-0000-0000-0000-000000000002', 'amy@example.com'),
  ('d0000000-0000-0000-0000-000000000003', 'ben@example.com'),
  ('d0000000-0000-0000-0000-000000000004', 'cat@example.com'),
  ('d0000000-0000-0000-0000-000000000005', 'dan@example.com'),
  ('d0000000-0000-0000-0000-000000000006', 'eve@example.com'),
  ('d0000000-0000-0000-0000-000000000007', 'fay@example.com'),
  ('d0000000-0000-0000-0000-000000000008', 'gil@example.com'),
  ('d0000000-0000-0000-0000-000000000009', 'hal@example.com')
) as u (id, email);

insert into public.terms_acceptances (user_id, version)
select id, 1 from auth.users where id::text like 'd0000000-%';

-- Amy turned 30 last month. Ben turns 30 this month, so he's shown as 29 until it's over.
insert into public.profiles (id, status, name, pronouns, bio, location, looking_for, birth_year, birth_month) values
  ('d0000000-0000-0000-0000-000000000001', 'admin', 'Kitchen Table', '-', '-', '-', '{}', null, null),
  ('d0000000-0000-0000-0000-000000000002', 'active', 'Amy', 'she/her', 'About Amy', 'London', '{friends,casual}',
    extract(year from now() - interval '30 years 1 month'), extract(month from now() - interval '30 years 1 month')),
  ('d0000000-0000-0000-0000-000000000003', 'active', 'Ben', 'he/him', 'About Ben', 'London', '{casual,Long walks}',
    extract(year from now() - interval '30 years'), extract(month from now())),
  ('d0000000-0000-0000-0000-000000000004', 'active', 'Cat', 'they/them', 'About Cat', 'London', '{friends}', null, null),
  ('d0000000-0000-0000-0000-000000000005', 'active', 'Dan', 'he/him', 'About Dan', 'London', '{friends}', null, null),
  ('d0000000-0000-0000-0000-000000000006', 'disabled', 'Eve', 'she/her', 'About Eve', 'London', '{friends}', null, null),
  ('d0000000-0000-0000-0000-000000000007', 'deleted', 'Fay', 'she/her', 'About Fay', 'London', '{friends}', null, null),
  ('d0000000-0000-0000-0000-000000000008', 'approved', 'Gil', 'he/him', 'About Gil', 'London', '{friends}', null, null),
  ('d0000000-0000-0000-0000-000000000009', 'active', 'Hal', 'he/him', 'About Hal', 'London', '{friends}', null, null);

-- Amy and Ben went live before Ada became an admin, so they're connected by hand, as the docs say.
do $$
begin
  perform public.connect_with_admins(id) from public.profiles
  where id in ('d0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003');
end;
$$;

-- Conversations with the admins ------------------------------------------

do $$
begin
  perform public.complete_age_verification('d0000000-0000-0000-0000-000000000008');
end;
$$;

select is(
  (select status from public.connections
   where initiator_id = 'd0000000-0000-0000-0000-000000000001' and recipient_id = 'd0000000-0000-0000-0000-000000000008'),
  'accepted'::public.connection_status,
  'a member going live gets an accepted connection with the admin'
);
select is(
  (select count(*) from public.connection_secrets
   where (user_id, other_user_id) in (
     ('d0000000-0000-0000-0000-000000000001'::uuid, 'd0000000-0000-0000-0000-000000000008'::uuid),
     ('d0000000-0000-0000-0000-000000000008'::uuid, 'd0000000-0000-0000-0000-000000000001'::uuid))),
  2::bigint,
  'with a connection_secrets row for each side'
);
select lives_ok($$ select public.connect_with_admins('d0000000-0000-0000-0000-000000000008') $$,
  'connecting a member with the admins again works');
select is(
  (select count(*) from public.connections
   where initiator_id = 'd0000000-0000-0000-0000-000000000001' and recipient_id = 'd0000000-0000-0000-0000-000000000008'),
  1::bigint,
  'and changes nothing'
);

-- Members can't write the tables -----------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000002';

select throws_ok(
  $$ insert into public.connections (initiator_id, recipient_id, status)
     values ('d0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000004', 'accepted') $$,
  '42501', null, 'members cannot insert connections');
select throws_ok(
  $$ insert into public.messages (sender_id, recipient_id, content)
     values ('d0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000004', '{}') $$,
  '42501', null, 'members cannot insert messages');
select throws_ok(
  $$ update public.connection_secrets set last_read_at = now() $$,
  '42501', null, 'members cannot update connection_secrets');
select throws_ok(
  $$ select public.connect_with_admins('d0000000-0000-0000-0000-000000000002') $$,
  '42501', null, 'members cannot call connect_with_admins');

-- Sending an intro (Amy to Ben) ------------------------------------------

select throws_ok(
  $$ select public.send_intro('d0000000-0000-0000-0000-000000000003', '{friends}', '{"type": "text", "text": "Hi Ben"}') $$,
  'P0001', 'Pick what to connect on from what this person is looking for.',
  'an intro can only pick from what the recipient is looking for');
select throws_ok(
  $$ select public.send_intro('d0000000-0000-0000-0000-000000000003', '{}', '{"type": "text", "text": "Hi Ben"}') $$,
  'P0001', 'Pick what to connect on from what this person is looking for.',
  'an intro needs something to connect on');
select throws_ok(
  $$ select public.send_intro('d0000000-0000-0000-0000-000000000003', null, '{"type": "text", "text": "Hi Ben"}') $$,
  'P0001', 'Pick what to connect on from what this person is looking for.',
  'an intro needs something to connect on, not null');
select throws_ok(
  $$ select public.send_intro('d0000000-0000-0000-0000-000000000003', '{casual}', '{"type": "text", "text": " \n "}') $$,
  'P0001', 'A message must be a text of 1 to 2000 characters.',
  'an intro needs more than whitespace');
select throws_ok(
  $$ select public.send_intro('d0000000-0000-0000-0000-000000000003', '{casual}',
       jsonb_build_object('type', 'text', 'text', repeat('x', 2001))) $$,
  'P0001', 'A message must be a text of 1 to 2000 characters.',
  'an intro can be at most 2000 characters');
select throws_ok(
  $$ select public.send_intro('d0000000-0000-0000-0000-000000000003', '{casual}', '{"type": "ended"}') $$,
  'P0001', 'A message must be a text of 1 to 2000 characters.',
  'members cannot send ended messages');
select throws_ok(
  $$ select public.send_intro('d0000000-0000-0000-0000-000000000003', '{casual}',
       '{"type": "text", "text": "Hi Ben", "html": "<b>Hi</b>"}') $$,
  'P0001', 'A message must be a text of 1 to 2000 characters.',
  'a message cannot have other fields');
select throws_ok(
  $$ select public.send_intro('d0000000-0000-0000-0000-000000000003', '{casual}', '"Hi Ben"') $$,
  'P0001', 'A message must be a text of 1 to 2000 characters.',
  'a message must be an object');
select throws_ok(
  $$ select public.send_intro('d0000000-0000-0000-0000-000000000001', '{casual}', '{"type": "text", "text": "Hi"}') $$,
  'P0001', 'Intros can only go to members whose profiles are live.',
  'members cannot send an intro to an admin');
select throws_ok(
  $$ select public.send_intro('d0000000-0000-0000-0000-000000000006', '{friends}', '{"type": "text", "text": "Hi"}') $$,
  'P0001', 'Intros can only go to members whose profiles are live.',
  'members cannot send an intro to a hidden profile');
select throws_ok(
  $$ select public.send_intro('d0000000-0000-0000-0000-000000000002', '{friends}', '{"type": "text", "text": "Hi"}') $$,
  'P0001', 'Intros can only go to members whose profiles are live.',
  'members cannot send an intro to themselves');

select lives_ok(
  $$ select public.send_intro('d0000000-0000-0000-0000-000000000003', '{casual,Long walks}',
       '{"type": "text", "text": "Hi Ben"}') $$,
  'an intro can pick the recipient''s own text too');
select is(
  (select status from public.connections
   where initiator_id = 'd0000000-0000-0000-0000-000000000002' and recipient_id = 'd0000000-0000-0000-0000-000000000003'),
  'pending'::public.connection_status,
  'an intro is a pending connection'
);
select is(
  (select looking_for from public.connections
   where initiator_id = 'd0000000-0000-0000-0000-000000000002' and recipient_id = 'd0000000-0000-0000-0000-000000000003'),
  '{casual,Long walks}'::text[],
  'with what the initiator wants to connect on'
);
select is(
  (select content from public.messages
   where sender_id = 'd0000000-0000-0000-0000-000000000002' and recipient_id = 'd0000000-0000-0000-0000-000000000003'),
  '{"type": "text", "text": "Hi Ben"}'::jsonb,
  'the intro text is the first message'
);

reset role;
select is(
  (select count(*) from public.connection_secrets
   where (user_id, other_user_id) in (
     ('d0000000-0000-0000-0000-000000000002'::uuid, 'd0000000-0000-0000-0000-000000000003'::uuid),
     ('d0000000-0000-0000-0000-000000000003'::uuid, 'd0000000-0000-0000-0000-000000000002'::uuid))
     and last_read_at is null),
  2::bigint,
  'both get a connection_secrets row, read by neither'
);
set local role authenticated;

select lives_ok(
  $$ select public.send_intro('d0000000-0000-0000-0000-000000000003', '{casual,Long walks}',
       '{"type": "text", "text": "Hi Ben"}') $$,
  'sending an intro again works');
select is(
  (select count(*) from public.messages
   where sender_id = 'd0000000-0000-0000-0000-000000000002' and recipient_id = 'd0000000-0000-0000-0000-000000000003'),
  1::bigint,
  'but changes nothing, so a retry is harmless'
);
select throws_ok(
  $$ select public.send_message(gen_random_uuid(), 'd0000000-0000-0000-0000-000000000003',
       '{"type": "text", "text": "Are you there?"}') $$,
  'P0001', 'You can only message people whose intro was accepted.',
  'no messages while the intro is pending');

-- The daily limit --------------------------------------------------------

select lives_ok(
  $$ select public.send_intro('d0000000-0000-0000-0000-000000000005', '{friends}', '{"type": "text", "text": "Hi Dan"}') $$,
  'a second intro in a day works');
select lives_ok(
  $$ select public.send_intro('d0000000-0000-0000-0000-000000000009', '{friends}', '{"type": "text", "text": "Hi Hal"}') $$,
  'a third intro in a day works');
select throws_ok(
  $$ select public.send_intro('d0000000-0000-0000-0000-000000000004', '{friends}', '{"type": "text", "text": "Hi Cat"}') $$,
  '54000', 'You can send 3 intros a day.',
  'a fourth intro in a day is refused');

reset role;
update public.connections set created_at = now() - interval '25 hours'
where initiator_id = 'd0000000-0000-0000-0000-000000000002' and recipient_id = 'd0000000-0000-0000-0000-000000000009';
set local role authenticated;

select lives_ok(
  $$ select public.send_intro('d0000000-0000-0000-0000-000000000004', '{friends}', '{"type": "text", "text": "Hi Cat"}') $$,
  'intros from more than a day ago do not count');

set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000006';
select throws_ok(
  $$ select public.send_intro('d0000000-0000-0000-0000-000000000005', '{friends}', '{"type": "text", "text": "Hi Dan"}') $$,
  'P0001', 'Your profile needs to be live to send intros.',
  'a hidden profile cannot send intros');

-- Receiving an intro (Ben) -----------------------------------------------

set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000003';

select is(
  (select count(*) from public.connections where initiator_id = 'd0000000-0000-0000-0000-000000000002'),
  1::bigint,
  'members only see their own connections'
);
select is(
  (select count(*) from public.messages where sender_id = 'd0000000-0000-0000-0000-000000000002'),
  1::bigint,
  'and their own messages'
);
select is(
  (select count(*) from public.connection_secrets where user_id <> 'd0000000-0000-0000-0000-000000000003'),
  0::bigint,
  'and only their own side of connection_secrets'
);
select throws_ok(
  $$ select public.send_intro('d0000000-0000-0000-0000-000000000002', '{friends}', '{"type": "text", "text": "Hi Amy"}') $$,
  'P0001', 'This person has already sent you an intro.',
  'members cannot send an intro to someone who sent them one');
select is(
  (select p - 'id' from jsonb_array_elements(public.get_connected_profiles()) p
   where p ->> 'id' = 'd0000000-0000-0000-0000-000000000002'),
  '{"name": "Amy", "pronouns": "she/her", "tagline": "", "bio": "About Amy", "location": "London",
    "gender": [], "sexuality": [], "looking_for": ["friends", "casual"], "age": 30, "photos": [],
    "is_admin": false}'::jsonb,
  'the recipient gets the initiator''s profile, with the age but no birth date or status'
);
select is(
  (select p -> 'is_admin' from jsonb_array_elements(public.get_connected_profiles()) p
   where p ->> 'id' = 'd0000000-0000-0000-0000-000000000001'),
  'true'::jsonb,
  'the admin is marked as such'
);
select throws_ok(
  $$ select public.decline_intro('d0000000-0000-0000-0000-000000000004') $$,
  'P0001', 'There is no intro from this person waiting for you.',
  'members cannot decline an intro nobody sent them');

select lives_ok($$ select public.accept_intro('d0000000-0000-0000-0000-000000000002') $$,
  'the recipient can accept an intro');
select is(
  (select status from public.connections
   where initiator_id = 'd0000000-0000-0000-0000-000000000002' and recipient_id = 'd0000000-0000-0000-0000-000000000003'),
  'accepted'::public.connection_status,
  'which makes the connection accepted'
);
select lives_ok($$ select public.accept_intro('d0000000-0000-0000-0000-000000000002') $$,
  'accepting again works');
select throws_ok(
  $$ select public.decline_intro('d0000000-0000-0000-0000-000000000002') $$,
  'P0001', 'There is no intro from this person waiting for you.',
  'an accepted intro cannot be declined');

set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000002';
select throws_ok(
  $$ select public.accept_intro('d0000000-0000-0000-0000-000000000003') $$,
  'P0001', 'There is no intro from this person.',
  'only the recipient can accept an intro');

-- Declining (Dan) --------------------------------------------------------

set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000005';

select lives_ok($$ select public.decline_intro('d0000000-0000-0000-0000-000000000002') $$,
  'the recipient can decline an intro');
select isnt(
  (select declined_at from public.connection_secrets
   where user_id = 'd0000000-0000-0000-0000-000000000005' and other_user_id = 'd0000000-0000-0000-0000-000000000002'),
  null,
  'which is recorded on their side'
);
select throws_ok(
  $$ select public.accept_intro('d0000000-0000-0000-0000-000000000002') $$,
  'P0001', 'You declined this intro already.',
  'a declined intro cannot be accepted');

set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000002';
select is(
  (select status from public.connections
   where initiator_id = 'd0000000-0000-0000-0000-000000000002' and recipient_id = 'd0000000-0000-0000-0000-000000000005'),
  'pending'::public.connection_status,
  'to the initiator, a declined intro still looks pending'
);
select is(
  (select count(*) from public.connection_secrets where user_id = 'd0000000-0000-0000-0000-000000000005'),
  0::bigint,
  'and they cannot see the decline'
);

-- Messages ---------------------------------------------------------------

set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000003';

select lives_ok(
  $$ select public.send_message('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002',
       '{"type": "text", "text": "Hi Amy"}') $$,
  'both can message once the intro is accepted');
select lives_ok(
  $$ select public.send_message('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002',
       '{"type": "text", "text": "Hi Amy"}') $$,
  'sending a message again works');
select is(
  (select count(*) from public.messages where id = 'e0000000-0000-0000-0000-000000000001'),
  1::bigint,
  'but changes nothing, so a retry is harmless'
);
select lives_ok(
  $$ select public.send_message(gen_random_uuid(), 'd0000000-0000-0000-0000-000000000002',
       jsonb_build_object('type', 'text', 'text', repeat('x', 2000))) $$,
  'a message can have 2000 characters');
select throws_ok(
  $$ select public.send_message(gen_random_uuid(), 'd0000000-0000-0000-0000-000000000002',
       jsonb_build_object('type', 'text', 'text', repeat('x', 2001))) $$,
  'P0001', 'A message must be a text of 1 to 2000 characters.',
  'but not more');
select throws_ok(
  $$ select public.send_message(gen_random_uuid(), 'd0000000-0000-0000-0000-000000000004',
       '{"type": "text", "text": "Hi Cat"}') $$,
  'P0001', 'You can only message people whose intro was accepted.',
  'no messages without a connection');

set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000002';
select throws_ok(
  $$ select public.send_message('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003',
       '{"type": "text", "text": "Hi Ben"}') $$,
  '23505', null,
  'a message id someone else used is refused');

-- Amy and Fay, Eve and Amy were connected before Fay deleted her profile and Eve hid hers.
reset role;
insert into public.connections (initiator_id, recipient_id, status, looking_for) values
  ('d0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000007', 'accepted', '{friends}'),
  ('d0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000002', 'accepted', '{friends}');
set local role authenticated;

select throws_ok(
  $$ select public.send_message(gen_random_uuid(), 'd0000000-0000-0000-0000-000000000007',
       '{"type": "text", "text": "Hi Fay"}') $$,
  'P0001', 'This person has deleted their account.',
  'no messages to someone who deleted their account');

set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000006';
select throws_ok(
  $$ select public.send_message(gen_random_uuid(), 'd0000000-0000-0000-0000-000000000002',
       '{"type": "text", "text": "Hi Amy"}') $$,
  'P0001', 'Your profile needs to be live to send messages.',
  'a hidden profile cannot send messages');

-- Read state (Ben) -------------------------------------------------------

set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000003';

select lives_ok(
  $$ select public.mark_read('d0000000-0000-0000-0000-000000000002', now() + interval '1 hour') $$,
  'members can mark a conversation as read');
select is(
  (select last_read_at from public.connection_secrets where other_user_id = 'd0000000-0000-0000-0000-000000000002'),
  now(),
  'up to now at most'
);
select lives_ok(
  $$ select public.mark_read('d0000000-0000-0000-0000-000000000002', now() - interval '1 day') $$,
  'marking it as read earlier works');
select is(
  (select last_read_at from public.connection_secrets where other_user_id = 'd0000000-0000-0000-0000-000000000002'),
  now(),
  'but never moves the time back'
);
select throws_ok(
  $$ select public.mark_read('d0000000-0000-0000-0000-000000000004', now()) $$,
  'P0001', 'There is no conversation with this person.',
  'there is nothing to mark without a conversation');

-- Dismissing (Ben dismisses Cat) -----------------------------------------

select lives_ok($$ select public.set_dismissed('d0000000-0000-0000-0000-000000000004', true) $$,
  'members can dismiss someone they have no connection with');
select isnt(
  (select dismissed_at from public.connection_secrets where other_user_id = 'd0000000-0000-0000-0000-000000000004'),
  null,
  'which is recorded on their side'
);
select lives_ok($$ select public.set_dismissed('d0000000-0000-0000-0000-000000000004', false) $$,
  'and undo it');
select is(
  (select dismissed_at from public.connection_secrets where other_user_id = 'd0000000-0000-0000-0000-000000000004'),
  null,
  'which clears it'
);

-- Ending a connection ----------------------------------------------------

select throws_ok(
  $$ select public.end_connection('d0000000-0000-0000-0000-000000000001') $$,
  'P0001', 'The conversation with the admins can''t be ended.',
  'members cannot end the conversation with the admins');

set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000001';
select throws_ok(
  $$ select public.end_connection('d0000000-0000-0000-0000-000000000003') $$,
  'P0001', 'The conversation with the admins can''t be ended.',
  'neither can the admin');

set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000005';
select throws_ok(
  $$ select public.end_connection('d0000000-0000-0000-0000-000000000002') $$,
  'P0001', 'There is no connection with this person to end.',
  'a pending intro cannot be ended');

set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000002';
select lives_ok($$ select public.end_connection('d0000000-0000-0000-0000-000000000003') $$,
  'either can end an accepted connection');
select is(
  (select status from public.connections
   where initiator_id = 'd0000000-0000-0000-0000-000000000002' and recipient_id = 'd0000000-0000-0000-0000-000000000003'),
  'ended'::public.connection_status,
  'which makes it ended'
);
select is(
  (select count(*) from public.messages
   where sender_id = 'd0000000-0000-0000-0000-000000000002' and recipient_id = 'd0000000-0000-0000-0000-000000000003'
     and content = '{"type": "ended"}'),
  1::bigint,
  'with an ended message from the person who ended it'
);
select throws_ok(
  $$ select public.end_connection('d0000000-0000-0000-0000-000000000003') $$,
  'P0001', 'There is no connection with this person to end.',
  'an ended connection cannot be ended again');

set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000003';
select throws_ok(
  $$ select public.send_message(gen_random_uuid(), 'd0000000-0000-0000-0000-000000000002',
       '{"type": "text", "text": "Wait"}') $$,
  'P0001', 'You can only message people whose intro was accepted.',
  'no messages after a connection has ended');
select throws_ok(
  $$ select public.accept_intro('d0000000-0000-0000-0000-000000000002') $$,
  'P0001', 'There is no intro from this person.',
  'an ended connection cannot be accepted again');

-- The admin --------------------------------------------------------------

set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000001';

select lives_ok(
  $$ select public.send_message(gen_random_uuid(), 'd0000000-0000-0000-0000-000000000002',
       '{"type": "text", "text": "Welcome, Amy!"}') $$,
  'the admin can message a member');
select is(
  (select count(*) from public.messages
   where 'd0000000-0000-0000-0000-000000000002' in (sender_id, recipient_id)
     and 'd0000000-0000-0000-0000-000000000001' not in (sender_id, recipient_id)),
  0::bigint,
  'but cannot read messages between members'
);
select is(
  (select count(*) from jsonb_array_elements(public.get_connected_profiles()) p
   where p ->> 'id' like 'd0000000-%'),
  3::bigint,
  'the admin''s connections are the members (Amy, Ben and Gil)'
);

set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000002';
select lives_ok(
  $$ select public.send_message(gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001',
       '{"type": "text", "text": "Thanks!"}') $$,
  'a member can message the admin');
select is(
  (select (p -> 'age')::int from jsonb_array_elements(public.get_connected_profiles()) p
   where p ->> 'id' = 'd0000000-0000-0000-0000-000000000003'),
  29,
  'the age goes up only once the birth month is over'
);

-- Anonymous --------------------------------------------------------------

reset role;
set local role anon;

select throws_ok($$ select * from public.messages $$, '42501', null, 'anon cannot read messages');
select throws_ok(
  $$ select public.send_intro('d0000000-0000-0000-0000-000000000003', '{casual}', '{"type": "text", "text": "Hi"}') $$,
  '42501', null, 'anon cannot send intros');

select * from finish();
rollback;
