begin;
select plan(2);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'gus@example.com', '{}'::jsonb, 'a-password-hash', now(), now(), now());

select is(
  (select encrypted_password from auth.users where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  null,
  'a password given at sign-up is not stored'
);

update auth.users set encrypted_password = 'another-hash' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select is(
  (select encrypted_password from auth.users where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  null,
  'a password set later is not stored either'
);

select * from finish();
rollback;
