


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."connection_status" AS ENUM (
    'pending',
    'accepted',
    'ended'
);


ALTER TYPE "public"."connection_status" OWNER TO "postgres";


CREATE TYPE "public"."profile_status" AS ENUM (
    'vetting',
    'approved',
    'active',
    'disabled',
    'suspended',
    'deleted',
    'admin'
);


ALTER TYPE "public"."profile_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_intro"("p_initiator_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  uid uuid := public.require_auth_uid();
begin
  if public.can_message((select status from public.profiles where id = uid)) is not true then
    raise exception 'Your profile needs to be live to accept intros.';
  end if;

  if exists (
    select 1 from public.connection_secrets
    where user_id = uid and other_user_id = p_initiator_id and declined_at is not null
  ) then
    raise exception 'You declined this intro already.';
  end if;

  update public.connections set status = 'accepted'
  where initiator_id = p_initiator_id and recipient_id = uid and status <> 'ended';
  if not found then
    raise exception 'There is no intro from this person.';
  end if;
end;
$$;


ALTER FUNCTION "public"."accept_intro"("p_initiator_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_approve_application"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.require_admin();
  update public.profiles
  set status = case when age_verified_at is null then 'approved' else 'active' end::public.profile_status
  where id = p_id and status = 'vetting';
  if not found then
    raise exception 'There is no application waiting for review with this id.';
  end if;
end;
$$;


ALTER FUNCTION "public"."admin_approve_application"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_applications"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.require_admin();
  return coalesce(
    (
      select jsonb_agg(to_jsonb(p) order by p.created_at)
      from public.profiles p
      where p.status = 'vetting'
    ),
    '[]'
  );
end;
$$;


ALTER FUNCTION "public"."admin_list_applications"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_message"("p_status" "public"."profile_status") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  select p_status in ('active', 'admin');
$$;


ALTER FUNCTION "public"."can_message"("p_status" "public"."profile_status") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_message_content"("p_content" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
begin
  if not coalesce(
    case when jsonb_typeof(p_content) = 'object' then
      p_content ->> 'type' = 'text'
      and p_content - 'type' - 'text' = '{}'
      and jsonb_typeof(p_content -> 'text') = 'string'
      and p_content ->> 'text' ~ '\S'
      and length(p_content ->> 'text') <= 2000
    end,
    false
  ) then
    raise exception 'A message must be a text of 1 to 2000 characters.';
  end if;
end;
$$;


ALTER FUNCTION "public"."check_message_content"("p_content" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_profile_fields"("p_name" "text", "p_pronouns" "text", "p_tagline" "text", "p_bio" "text", "p_birth_year" integer, "p_birth_month" integer, "p_looking_for" "text"[], "p_photos" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
declare
  age int;
begin
  if coalesce(trim(p_name), '') = ''
    or coalesce(trim(p_pronouns), '') = ''
    or coalesce(trim(p_bio), '') = ''
  then
    raise exception 'Name, pronouns and bio are required.';
  end if;

  if length(coalesce(p_tagline, '')) > 60 then
    raise exception 'The tagline can be at most 60 characters.';
  end if;

  if coalesce(cardinality(p_looking_for), 0) = 0 then
    raise exception 'Say what you are looking for.';
  end if;

  -- Month and year of birth are optional, but must come together and mean an adult.
  if (p_birth_year is null) <> (p_birth_month is null) then
    raise exception 'Give both a birth month and a birth year, or neither.';
  end if;
  if p_birth_year is not null then
    if p_birth_month not between 1 and 12 or p_birth_year < 1900 then
      raise exception 'Invalid birth month or year.';
    end if;
    age := extract(year from now())::int - p_birth_year;
    if extract(month from now())::int < p_birth_month then
      age := age - 1; -- this year's birthday hasn't happened yet
    end if;
    if age < 18 then
      raise exception 'You must be at least 18.';
    end if;
  end if;

  -- One to six distinct photos. (The files themselves are in the caller's own folder of the
  -- photos bucket, see docs/photos.md; this doesn't check that they exist.)
  if coalesce(cardinality(p_photos), 0) not between 1 and 6
    or cardinality(p_photos) <> (select count(distinct id) from unnest(p_photos) as id)
  then
    raise exception 'Add between 1 and 6 different photos.';
  end if;
end;
$$;


ALTER FUNCTION "public"."check_profile_fields"("p_name" "text", "p_pronouns" "text", "p_tagline" "text", "p_bio" "text", "p_birth_year" integer, "p_birth_month" integer, "p_looking_for" "text"[], "p_photos" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_age_verification"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.profiles
  set status = case when status = 'approved' then 'active' else status end,
      age_verified_at = now()
  where id = p_user_id and status in ('vetting', 'approved') and age_verified_at is null;
  return found;
end;
$$;


ALTER FUNCTION "public"."complete_age_verification"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."connect_new_member_with_admins"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.connect_with_admins(new.id);
  return null;
end;
$$;


ALTER FUNCTION "public"."connect_new_member_with_admins"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."connect_with_admins"("p_member_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  insert into public.connections (initiator_id, recipient_id, status)
  select id, p_member_id, 'accepted' from public.profiles where status = 'admin'
  on conflict do nothing;

  insert into public.connection_secrets (user_id, other_user_id)
  select id, p_member_id from public.profiles where status = 'admin'
  union all
  select p_member_id, id from public.profiles where status = 'admin'
  on conflict do nothing;
$$;


ALTER FUNCTION "public"."connect_with_admins"("p_member_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decline_intro"("p_initiator_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  uid uuid := public.require_auth_uid();
begin
  if not exists (
    select 1 from public.connections
    where initiator_id = p_initiator_id and recipient_id = uid and status = 'pending'
  ) then
    raise exception 'There is no intro from this person waiting for you.';
  end if;

  update public.connection_secrets set declined_at = coalesce(declined_at, now())
  where user_id = uid and other_user_id = p_initiator_id;
end;
$$;


ALTER FUNCTION "public"."decline_intro"("p_initiator_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."discard_password"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.encrypted_password := null;
  return new;
end;
$$;


ALTER FUNCTION "public"."discard_password"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."email_notification_due"("p_emailed" timestamp with time zone, "p_read" timestamp with time zone, "p_first_new" timestamp with time zone) RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select p_first_new <= now() - interval '15 minutes'
    and (
      p_emailed is null
      or p_read >= p_emailed
      or now() - p_emailed >= least(greatest(p_emailed - p_read, interval '1 day'), interval '14 days')
    );
$$;


ALTER FUNCTION "public"."email_notification_due"("p_emailed" timestamp with time zone, "p_read" timestamp with time zone, "p_first_new" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."end_connection"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  uid uuid := public.require_auth_uid();
begin
  if exists (select 1 from public.profiles where id in (uid, p_user_id) and status = 'admin') then
    raise exception 'The conversation with the admins can''t be ended.';
  end if;

  update public.connections set status = 'ended'
  where status = 'accepted'
    and (initiator_id, recipient_id) in ((uid, p_user_id), (p_user_id, uid));
  if not found then
    raise exception 'There is no connection with this person to end.';
  end if;

  insert into public.messages (sender_id, recipient_id, content)
  values (uid, p_user_id, '{"type": "ended"}');
end;
$$;


ALTER FUNCTION "public"."end_connection"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gender_filter_values"("p_gender" "text"[]) RETURNS "text"[]
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  select case when cardinality(p_gender) = 0 then array['not-specified'] else array(
    select distinct case when g = any (array[
      'Non-binary', 'Man', 'Woman', 'Genderqueer', 'Genderfluid', 'Agender', 'Gender questioning'
    ]) then g else 'self-described' end
    from unnest(p_gender) g
  ) end;
$$;


ALTER FUNCTION "public"."gender_filter_values"("p_gender" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_connected_profiles"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  uid uuid := public.require_auth_uid();
begin
  return coalesce(
    (
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'pronouns', p.pronouns,
        'tagline', p.tagline,
        'bio', p.bio,
        'location', p.location,
        'gender', p.gender,
        'sexuality', p.sexuality,
        'looking_for', p.looking_for,
        'age', extract(
          year from age(now(), make_date(p.birth_year, p.birth_month, 1) + interval '1 month')
        )::int,
        'photos', p.photos,
        'is_admin', p.status = 'admin'
      ))
      from public.connections c
      join public.profiles p
        on p.id = case when c.initiator_id = uid then c.recipient_id else c.initiator_id end
      where uid in (c.initiator_id, c.recipient_id)
    ),
    '[]'
  );
end;
$$;


ALTER FUNCTION "public"."get_connected_profiles"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_profile"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select to_jsonb(p) - 'vetting_answers'
  from public.profiles p
  where p.id = public.require_auth_uid();
$$;


ALTER FUNCTION "public"."get_my_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'admin');
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "status" "public"."profile_status" DEFAULT 'vetting'::"public"."profile_status" NOT NULL,
    "vetting_answers" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "name" "text" NOT NULL,
    "pronouns" "text" NOT NULL,
    "tagline" "text" DEFAULT ''::"text" NOT NULL,
    "bio" "text" NOT NULL,
    "location" "text" NOT NULL,
    "gender" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "sexuality" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "birth_year" integer,
    "birth_month" integer,
    "looking_for" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "photos" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "age_verified_at" timestamp with time zone,
    "search_filters" "jsonb",
    "hide_by_gender" boolean DEFAULT false NOT NULL,
    "intro_emails" boolean DEFAULT true NOT NULL,
    "message_emails" boolean DEFAULT true NOT NULL,
    "intros_emailed_at" timestamp with time zone,
    "messages_emailed_at" timestamp with time zone,
    CONSTRAINT "profiles_photos_check" CHECK (("cardinality"("photos") <= 6))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_hidden_by_gender"("p_profile" "public"."profiles", "p_viewer_gender" "text"[]) RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  select p_profile.hide_by_gender
    and not coalesce(
      p_profile.search_filters -> 'gender' ?| public.gender_filter_values(p_viewer_gender),
      false
    );
$$;


ALTER FUNCTION "public"."is_hidden_by_gender"("p_profile" "public"."profiles", "p_viewer_gender" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_member_photo"("p_name" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'active')
    and exists (
      select 1 from public.profiles p
      where p.id::text = (storage.foldername(p_name))[1]
        and p.status = 'active'
        and (storage.foldername(p_name))[2] = any (p.photos::text[])
    );
$$;


ALTER FUNCTION "public"."is_member_photo"("p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."last_read_at"("p_profile" "public"."profiles") RETURNS timestamp with time zone
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select coalesce(max(last_read_at), p_profile.created_at)
  from public.connection_secrets
  where user_id = p_profile.id;
$$;


ALTER FUNCTION "public"."last_read_at"("p_profile" "public"."profiles") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_read"("p_user_id" "uuid", "p_read_at" timestamp with time zone) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  uid uuid := public.require_auth_uid();
begin
  update public.connection_secrets
  set last_read_at = greatest(last_read_at, least(p_read_at, now()))
  where user_id = uid and other_user_id = p_user_id;
  if not found then
    raise exception 'There is no conversation with this person.';
  end if;
end;
$$;


ALTER FUNCTION "public"."mark_read"("p_user_id" "uuid", "p_read_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_admin_of_application"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform public.send_email('application_submitted');
  return null;
end;
$$;


ALTER FUNCTION "public"."notify_admin_of_application"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_member_of_approval"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform public.send_email('application_approved', new.id);
  return null;
end;
$$;


ALTER FUNCTION "public"."notify_member_of_approval"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_profile_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  fields text[];
begin
  -- Every column, so new ones count too, except bookkeeping that changes without anyone editing
  -- anything: add any such column here.
  select array_agg(n.key order by n.key) into fields
  from jsonb_each(to_jsonb(new)) as n
  where n.key not in ('updated_at', 'intros_emailed_at', 'messages_emailed_at')
    and n.value is distinct from to_jsonb(old) -> n.key;

  if fields is not null then
    insert into public.analytics_events (user_id, name, props)
    values (new.id, 'profile_changed', jsonb_build_object(
      'fields', fields,
      'by', case
        when auth.uid() = new.id then 'self'
        when public.is_admin() then 'admin'
        else 'system'
      end
    ));
  end if;
  return null;
end;
$$;


ALTER FUNCTION "public"."record_profile_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."require_admin"() RETURNS "void"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = 'insufficient_privilege';
  end if;
end;
$$;


ALTER FUNCTION "public"."require_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."require_auth_uid"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated.';
  end if;
  return uid;
end;
$$;


ALTER FUNCTION "public"."require_auth_uid"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."require_terms_accepted"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if not exists (select 1 from public.terms_acceptances where user_id = new.id) then
    raise exception 'The terms must be accepted first.';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."require_terms_accepted"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_profiles"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  uid uuid := public.require_auth_uid();
  me public.profiles;
begin
  select * into me from public.profiles where id = uid;
  if not found or me.status not in ('active', 'admin') then
    raise exception 'Only members can search.' using errcode = 'insufficient_privilege';
  end if;

  return coalesce(
    (
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'pronouns', p.pronouns,
        'tagline', p.tagline,
        'bio', p.bio,
        'location', p.location,
        'gender', p.gender,
        'sexuality', p.sexuality,
        'looking_for', p.looking_for,
        'age', extract(
          year from age(now(), make_date(p.birth_year, p.birth_month, 1) + interval '1 month')
        )::int,
        'photos', p.photos
      ) order by p.age_verified_at desc, p.id)
      from public.profiles p
      where p.status = 'active'
        and p.id <> uid
        and lower(p.location) = lower(me.location)
        and (me.status = 'admin' or not exists (
          select 1 from public.connections c
          where (c.initiator_id = uid and c.recipient_id = p.id)
             or (c.initiator_id = p.id and c.recipient_id = uid)
        ))
        and not exists (
          select 1 from public.connection_secrets s
          where s.user_id = uid and s.other_user_id = p.id
            and (s.dismissed_at is not null or s.declined_at is not null)
        )
        and not public.is_hidden_by_gender(p, me.gender)
    ),
    '[]'
  );
end;
$$;


ALTER FUNCTION "public"."search_profiles"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_email"("p_template" "text", "p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  url text;
  secret text;
begin
  select decrypted_secret into url from vault.decrypted_secrets where name = 'send_email_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'send_email_secret';
  if url is null or secret is null then
    raise warning 'send_email_url or send_email_secret is missing from the vault, so the % email is not sent.', p_template;
    return;
  end if;

  perform net.http_post(
    url := url,
    body := jsonb_strip_nulls(jsonb_build_object('template', p_template, 'user_id', p_user_id)),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-send-email-secret', secret)
  );
end;
$$;


ALTER FUNCTION "public"."send_email"("p_template" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_email_notifications"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  uid uuid;
begin
  -- Intros: pending ones the user hasn't declined or seen yet.
  for uid in
    update public.profiles p
    set intros_emailed_at = now()
    from (
      select c.recipient_id as id, min(c.created_at) as first_new
      from public.connections c
      join public.profiles r on r.id = c.recipient_id
      join public.connection_secrets s
        on s.user_id = c.recipient_id and s.other_user_id = c.initiator_id
      where c.status = 'pending'
        and s.declined_at is null
        and s.last_read_at is null
        and c.created_at > coalesce(r.intros_emailed_at, '-infinity')
      group by c.recipient_id
    ) new
    where p.id = new.id
      and public.can_message(p.status)
      and p.intro_emails
      and public.email_notification_due(p.intros_emailed_at, public.last_read_at(p), new.first_new)
    returning p.id
  loop
    perform public.send_email('new_intros', uid);
  end loop;

  -- Messages: unread ones in accepted connections, and accepted intros the initiator hasn't
  -- opened yet (when accepted is when the connection last changed). Not the conversations with
  -- the admins (with an empty looking_for), which start accepted.
  for uid in
    update public.profiles p
    set messages_emailed_at = now()
    from (
      select arrived.id, min(arrived.at) as first_new
      from (
        select m.recipient_id as id, m.created_at as at
        from public.messages m
        join public.connections c
          on (c.initiator_id, c.recipient_id) in ((m.sender_id, m.recipient_id), (m.recipient_id, m.sender_id))
        join public.connection_secrets s
          on s.user_id = m.recipient_id and s.other_user_id = m.sender_id
        where c.status = 'accepted'
          and not m.deleted
          and m.created_at > coalesce(s.last_read_at, '-infinity')
        union all
        select c.initiator_id, c.updated_at
        from public.connections c
        join public.connection_secrets s
          on s.user_id = c.initiator_id and s.other_user_id = c.recipient_id
        where c.status = 'accepted'
          and c.looking_for <> '{}'
          and s.last_read_at is null
      ) arrived
      join public.profiles r on r.id = arrived.id
      where arrived.at > coalesce(r.messages_emailed_at, '-infinity')
      group by arrived.id
    ) new
    where p.id = new.id
      and public.can_message(p.status)
      and p.message_emails
      and public.email_notification_due(p.messages_emailed_at, public.last_read_at(p), new.first_new)
    returning p.id
  loop
    perform public.send_email('new_messages', uid);
  end loop;
end;
$$;


ALTER FUNCTION "public"."send_email_notifications"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_intro"("p_recipient_id" "uuid", "p_looking_for" "text"[], "p_content" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  uid uuid := public.require_auth_uid();
  my_gender text[];
  recipient public.profiles;
begin
  -- Locking the initiator's row makes their intros one at a time, so the daily limit holds.
  select gender into my_gender from public.profiles where id = uid and status = 'active' for update;
  if not found then
    raise exception 'Your profile needs to be live to send intros.';
  end if;

  if exists (
    select 1 from public.connections where initiator_id = uid and recipient_id = p_recipient_id
  ) then
    return;
  end if;

  select * into recipient from public.profiles where id = p_recipient_id;
  if recipient.status is distinct from 'active'
    or uid = p_recipient_id
    or public.is_hidden_by_gender(recipient, my_gender)
  then
    raise exception 'Intros can only go to members whose profiles are live.';
  end if;

  if exists (
    select 1 from public.connections where initiator_id = p_recipient_id and recipient_id = uid
  ) then
    raise exception 'This person has already sent you an intro.';
  end if;

  -- 3 intros a day, where days start at 3am UTC (the quietest hour, and simple).
  if (
    select count(*) from public.connections
    where initiator_id = uid
      and created_at >= (date_trunc('day', now() at time zone 'UTC' - interval '3 hours')
                         + interval '3 hours') at time zone 'UTC'
  ) >= 3 then
    raise exception 'You can send 3 intros a day.' using errcode = 'program_limit_exceeded';
  end if;

  if coalesce(cardinality(p_looking_for), 0) = 0
    or not coalesce(p_looking_for <@ recipient.looking_for, false)
  then
    raise exception 'Pick what to connect on from what this person is looking for.';
  end if;

  perform public.check_message_content(p_content);

  insert into public.connections (initiator_id, recipient_id, looking_for)
  values (uid, p_recipient_id, p_looking_for);

  insert into public.messages (sender_id, recipient_id, content)
  values (uid, p_recipient_id, p_content);

  -- Either row may already exist from a dismissal.
  insert into public.connection_secrets (user_id, other_user_id)
  values (uid, p_recipient_id), (p_recipient_id, uid)
  on conflict do nothing;
end;
$$;


ALTER FUNCTION "public"."send_intro"("p_recipient_id" "uuid", "p_looking_for" "text"[], "p_content" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_message"("p_id" "uuid", "p_recipient_id" "uuid", "p_content" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  uid uuid := public.require_auth_uid();
begin
  if exists (
    select 1 from public.messages
    where id = p_id and sender_id = uid and recipient_id = p_recipient_id
  ) then
    return;
  end if;

  perform public.check_message_content(p_content);

  if public.can_message((select status from public.profiles where id = uid)) is not true then
    raise exception 'Your profile needs to be live to send messages.';
  end if;

  if not exists (
    select 1 from public.connections
    where status = 'accepted'
      and (initiator_id, recipient_id) in ((uid, p_recipient_id), (p_recipient_id, uid))
  ) then
    raise exception 'You can only message people whose intro was accepted.';
  end if;

  if (select status from public.profiles where id = p_recipient_id) = 'deleted' then
    raise exception 'This person has deleted their account.';
  end if;

  insert into public.messages (id, sender_id, recipient_id, content)
  values (p_id, uid, p_recipient_id, p_content);
end;
$$;


ALTER FUNCTION "public"."send_message"("p_id" "uuid", "p_recipient_id" "uuid", "p_content" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_dismissed"("p_user_id" "uuid", "p_dismissed" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  uid uuid := public.require_auth_uid();
begin
  insert into public.connection_secrets (user_id, other_user_id, dismissed_at)
  values (uid, p_user_id, case when p_dismissed then now() end)
  on conflict (user_id, other_user_id) do update set dismissed_at = excluded.dismissed_at;
end;
$$;


ALTER FUNCTION "public"."set_dismissed"("p_user_id" "uuid", "p_dismissed" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_search_filters"("p_filters" "jsonb", "p_hide_by_gender" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  uid uuid := public.require_auth_uid();
begin
  if not coalesce(
    case when jsonb_typeof(p_filters) = 'object' then
      p_filters ?& array['looking_for', 'gender', 'min_age', 'max_age', 'show_unspecified_age']
      and p_filters - array['looking_for', 'gender', 'min_age', 'max_age', 'show_unspecified_age'] = '{}'
      and length(p_filters::text) <= 1000
      -- For arrays, <@ means every element is one of the allowed strings.
      and jsonb_typeof(p_filters -> 'looking_for') = 'array'
      and p_filters -> 'looking_for' <@ '["polyamory", "open-relationship", "relationship-anarchy",
        "friends", "exploring", "casual", "play-partners", "monogamy", "self-described"]'
      and jsonb_typeof(p_filters -> 'gender') = 'array'
      and p_filters -> 'gender' <@ '["Non-binary", "Man", "Woman", "Genderqueer", "Genderfluid",
        "Agender", "Gender questioning", "self-described", "not-specified"]'
      and p_filters ->> 'min_age' ~ '^\d{2}$'
      and p_filters ->> 'max_age' ~ '^\d{2}$'
      and (p_filters ->> 'min_age')::int between 18 and (p_filters ->> 'max_age')::int
      and (p_filters ->> 'max_age')::int <= 70
      and jsonb_typeof(p_filters -> 'show_unspecified_age') = 'boolean'
      and p_hide_by_gender is not null
    end,
    false
  ) then
    raise exception 'Invalid search filters.';
  end if;

  update public.profiles
  set search_filters = p_filters,
      hide_by_gender = p_hide_by_gender and jsonb_array_length(p_filters -> 'gender') > 0
  where id = uid;
  if not found then
    raise exception 'There is no profile.';
  end if;
end;
$_$;


ALTER FUNCTION "public"."set_search_filters"("p_filters" "jsonb", "p_hide_by_gender" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_onboarding"("p_name" "text", "p_pronouns" "text", "p_tagline" "text", "p_bio" "text", "p_location" "text", "p_gender" "text"[], "p_sexuality" "text"[], "p_birth_year" integer, "p_birth_month" integer, "p_looking_for" "text"[], "p_photos" "uuid"[], "p_vetting_answers" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  uid uuid := public.require_auth_uid();
  invite_code text;
begin
  perform public.check_profile_fields(
    p_name, p_pronouns, p_tagline, p_bio, p_birth_year, p_birth_month, p_looking_for, p_photos
  );

  if coalesce(trim(p_location), '') = '' then
    raise exception 'A location is required.';
  end if;

  if jsonb_typeof(p_vetting_answers) is distinct from 'object' then
    raise exception 'The vetting answers must be an object (it may be empty).';
  end if;

  -- The invite code comes from the sign-up metadata, which the user can edit, so it is only a
  -- hint for the person vetting (and capped in length). Stored with the vetting answers, as
  -- `invite_code`, and left out if there is none.
  select left(u.raw_user_meta_data ->> 'invite_code', 100) into invite_code
  from auth.users u
  where u.id = uid;

  insert into public.profiles (
    id, status, vetting_answers, name, pronouns, tagline, bio, location, gender, sexuality,
    birth_year, birth_month, looking_for, photos
  )
  values (
    uid, 'vetting',
    p_vetting_answers || jsonb_strip_nulls(jsonb_build_object('invite_code', invite_code)),
    trim(p_name), trim(p_pronouns),
    trim(coalesce(p_tagline, '')), trim(p_bio), trim(p_location),
    coalesce(p_gender, '{}'), coalesce(p_sexuality, '{}'),
    p_birth_year, p_birth_month, p_looking_for, p_photos
  )
  on conflict (id) do nothing;

  if not found then
    raise exception 'You have already applied.' using errcode = 'unique_violation';
  end if;
end;
$$;


ALTER FUNCTION "public"."submit_onboarding"("p_name" "text", "p_pronouns" "text", "p_tagline" "text", "p_bio" "text", "p_location" "text", "p_gender" "text"[], "p_sexuality" "text"[], "p_birth_year" integer, "p_birth_month" integer, "p_looking_for" "text"[], "p_photos" "uuid"[], "p_vetting_answers" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."track_event"("p_name" "text", "p_props" "jsonb" DEFAULT NULL::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  uid uuid := public.require_auth_uid();
begin
  if p_name is null or p_name not in (
    'onboarding_step_viewed', 'invite_link_shared', 'photo_rejected', 'profile_preview_opened'
  ) then
    raise exception 'Unknown event.';
  end if;

  if p_props is not null and (jsonb_typeof(p_props) <> 'object' or length(p_props::text) > 500) then
    raise exception 'Event properties must be a small JSON object.';
  end if;

  insert into public.analytics_events (user_id, name, props) values (uid, p_name, p_props);
end;
$$;


ALTER FUNCTION "public"."track_event"("p_name" "text", "p_props" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_profile"("p_name" "text", "p_pronouns" "text", "p_tagline" "text", "p_bio" "text", "p_gender" "text"[], "p_sexuality" "text"[], "p_birth_year" integer, "p_birth_month" integer, "p_looking_for" "text"[], "p_photos" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  uid uuid := public.require_auth_uid();
begin
  perform public.check_profile_fields(
    p_name, p_pronouns, p_tagline, p_bio, p_birth_year, p_birth_month, p_looking_for, p_photos
  );

  update public.profiles
  set name = trim(p_name),
      pronouns = trim(p_pronouns),
      tagline = trim(coalesce(p_tagline, '')),
      bio = trim(p_bio),
      gender = coalesce(p_gender, '{}'),
      sexuality = coalesce(p_sexuality, '{}'),
      birth_year = p_birth_year,
      birth_month = p_birth_month,
      looking_for = p_looking_for,
      photos = p_photos
  where id = uid and status in ('active', 'disabled', 'admin');

  if not found then
    raise exception 'There is no live profile to update.';
  end if;
end;
$$;


ALTER FUNCTION "public"."update_profile"("p_name" "text", "p_pronouns" "text", "p_tagline" "text", "p_bio" "text", "p_gender" "text"[], "p_sexuality" "text"[], "p_birth_year" integer, "p_birth_month" integer, "p_looking_for" "text"[], "p_photos" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_settings"("p_intro_emails" boolean, "p_message_emails" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  uid uuid := public.require_auth_uid();
begin
  if p_intro_emails is null or p_message_emails is null then
    raise exception 'Invalid settings.';
  end if;

  update public.profiles
  set intro_emails = p_intro_emails,
      message_emails = p_message_emails
  where id = uid;
  if not found then
    raise exception 'There is no profile.';
  end if;
end;
$$;


ALTER FUNCTION "public"."update_settings"("p_intro_emails" boolean, "p_message_emails" boolean) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_events" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "props" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."analytics_events" OWNER TO "postgres";


ALTER TABLE "public"."analytics_events" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."analytics_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."connection_secrets" (
    "user_id" "uuid" NOT NULL,
    "other_user_id" "uuid" NOT NULL,
    "dismissed_at" timestamp with time zone,
    "declined_at" timestamp with time zone,
    "last_read_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "connection_secrets_check" CHECK (("user_id" <> "other_user_id"))
);


ALTER TABLE "public"."connection_secrets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."connections" (
    "initiator_id" "uuid" NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "status" "public"."connection_status" DEFAULT 'pending'::"public"."connection_status" NOT NULL,
    "looking_for" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "connections_check" CHECK (("initiator_id" <> "recipient_id"))
);


ALTER TABLE "public"."connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "content" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."terms_acceptances" (
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "version" integer NOT NULL,
    "accepted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "terms_acceptances_version_check" CHECK (("version" > 0))
);


ALTER TABLE "public"."terms_acceptances" OWNER TO "postgres";


ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."connection_secrets"
    ADD CONSTRAINT "connection_secrets_pkey" PRIMARY KEY ("user_id", "other_user_id");



ALTER TABLE ONLY "public"."connections"
    ADD CONSTRAINT "connections_pkey" PRIMARY KEY ("initiator_id", "recipient_id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."terms_acceptances"
    ADD CONSTRAINT "terms_acceptances_pkey" PRIMARY KEY ("user_id", "version");



CREATE INDEX "analytics_events_name_created_at" ON "public"."analytics_events" USING "btree" ("name", "created_at");



CREATE INDEX "connection_secrets_user_updated_at" ON "public"."connection_secrets" USING "btree" ("user_id", "updated_at");



CREATE INDEX "connections_initiator_updated_at" ON "public"."connections" USING "btree" ("initiator_id", "updated_at");



CREATE UNIQUE INDEX "connections_pair" ON "public"."connections" USING "btree" (LEAST("initiator_id", "recipient_id"), GREATEST("initiator_id", "recipient_id"));



CREATE INDEX "connections_recipient_updated_at" ON "public"."connections" USING "btree" ("recipient_id", "updated_at");



CREATE INDEX "messages_recipient_updated_at" ON "public"."messages" USING "btree" ("recipient_id", "updated_at", "id");



CREATE INDEX "messages_sender_updated_at" ON "public"."messages" USING "btree" ("sender_id", "updated_at", "id");



CREATE OR REPLACE TRIGGER "connect_new_member_with_admins" AFTER UPDATE OF "status" ON "public"."profiles" FOR EACH ROW WHEN ((("old"."status" = ANY (ARRAY['vetting'::"public"."profile_status", 'approved'::"public"."profile_status"])) AND ("new"."status" = 'active'::"public"."profile_status"))) EXECUTE FUNCTION "public"."connect_new_member_with_admins"();



CREATE OR REPLACE TRIGGER "connection_secrets_set_updated_at" BEFORE UPDATE ON "public"."connection_secrets" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "connections_set_updated_at" BEFORE UPDATE ON "public"."connections" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "messages_set_updated_at" BEFORE UPDATE ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "notify_admin_of_application" AFTER INSERT ON "public"."profiles" FOR EACH ROW WHEN (("new"."status" = 'vetting'::"public"."profile_status")) EXECUTE FUNCTION "public"."notify_admin_of_application"();



CREATE OR REPLACE TRIGGER "notify_member_of_approval" AFTER UPDATE OF "status" ON "public"."profiles" FOR EACH ROW WHEN ((("old"."status" = 'vetting'::"public"."profile_status") AND ("new"."status" = ANY (ARRAY['approved'::"public"."profile_status", 'active'::"public"."profile_status"])))) EXECUTE FUNCTION "public"."notify_member_of_approval"();



CREATE OR REPLACE TRIGGER "profiles_record_change" AFTER UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."record_profile_change"();



CREATE OR REPLACE TRIGGER "profiles_require_terms_accepted" BEFORE INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."require_terms_accepted"();



CREATE OR REPLACE TRIGGER "profiles_set_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."connection_secrets"
    ADD CONSTRAINT "connection_secrets_other_user_id_fkey" FOREIGN KEY ("other_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."connection_secrets"
    ADD CONSTRAINT "connection_secrets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."connections"
    ADD CONSTRAINT "connections_initiator_id_fkey" FOREIGN KEY ("initiator_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."connections"
    ADD CONSTRAINT "connections_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."terms_acceptances"
    ADD CONSTRAINT "terms_acceptances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."analytics_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."connection_secrets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "connection_secrets_select_own" ON "public"."connection_secrets" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."connections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "connections_select_own" ON "public"."connections" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "initiator_id") OR (( SELECT "auth"."uid"() AS "uid") = "recipient_id")));



ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages_select_own" ON "public"."messages" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "sender_id") OR (( SELECT "auth"."uid"() AS "uid") = "recipient_id")));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."terms_acceptances" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "terms_acceptances_insert_own" ON "public"."terms_acceptances" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "terms_acceptances_select_own" ON "public"."terms_acceptances" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."accept_intro"("p_initiator_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accept_intro"("p_initiator_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_approve_application"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_approve_application"("p_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_list_applications"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_list_applications"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."can_message"("p_status" "public"."profile_status") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."check_message_content"("p_content" "jsonb") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."check_profile_fields"("p_name" "text", "p_pronouns" "text", "p_tagline" "text", "p_bio" "text", "p_birth_year" integer, "p_birth_month" integer, "p_looking_for" "text"[], "p_photos" "uuid"[]) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."complete_age_verification"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."complete_age_verification"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."connect_new_member_with_admins"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."connect_with_admins"("p_member_id" "uuid") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."decline_intro"("p_initiator_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."decline_intro"("p_initiator_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."email_notification_due"("p_emailed" timestamp with time zone, "p_read" timestamp with time zone, "p_first_new" timestamp with time zone) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."end_connection"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."end_connection"("p_user_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."gender_filter_values"("p_gender" "text"[]) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."get_connected_profiles"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_connected_profiles"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_my_profile"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_profile"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."is_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";



GRANT ALL ON TABLE "public"."profiles" TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_hidden_by_gender"("p_profile" "public"."profiles", "p_viewer_gender" "text"[]) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."is_member_photo"("p_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_member_photo"("p_name" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."last_read_at"("p_profile" "public"."profiles") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."mark_read"("p_user_id" "uuid", "p_read_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_read"("p_user_id" "uuid", "p_read_at" timestamp with time zone) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."notify_admin_of_application"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."notify_member_of_approval"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."record_profile_change"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."require_admin"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."require_auth_uid"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."require_terms_accepted"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."search_profiles"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_profiles"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."send_email"("p_template" "text", "p_user_id" "uuid") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."send_email_notifications"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."send_email_notifications"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."send_intro"("p_recipient_id" "uuid", "p_looking_for" "text"[], "p_content" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."send_intro"("p_recipient_id" "uuid", "p_looking_for" "text"[], "p_content" "jsonb") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."send_message"("p_id" "uuid", "p_recipient_id" "uuid", "p_content" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."send_message"("p_id" "uuid", "p_recipient_id" "uuid", "p_content" "jsonb") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."set_dismissed"("p_user_id" "uuid", "p_dismissed" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_dismissed"("p_user_id" "uuid", "p_dismissed" boolean) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."set_search_filters"("p_filters" "jsonb", "p_hide_by_gender" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_search_filters"("p_filters" "jsonb", "p_hide_by_gender" boolean) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."submit_onboarding"("p_name" "text", "p_pronouns" "text", "p_tagline" "text", "p_bio" "text", "p_location" "text", "p_gender" "text"[], "p_sexuality" "text"[], "p_birth_year" integer, "p_birth_month" integer, "p_looking_for" "text"[], "p_photos" "uuid"[], "p_vetting_answers" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_onboarding"("p_name" "text", "p_pronouns" "text", "p_tagline" "text", "p_bio" "text", "p_location" "text", "p_gender" "text"[], "p_sexuality" "text"[], "p_birth_year" integer, "p_birth_month" integer, "p_looking_for" "text"[], "p_photos" "uuid"[], "p_vetting_answers" "jsonb") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."track_event"("p_name" "text", "p_props" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."track_event"("p_name" "text", "p_props" "jsonb") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."update_profile"("p_name" "text", "p_pronouns" "text", "p_tagline" "text", "p_bio" "text", "p_gender" "text"[], "p_sexuality" "text"[], "p_birth_year" integer, "p_birth_month" integer, "p_looking_for" "text"[], "p_photos" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_profile"("p_name" "text", "p_pronouns" "text", "p_tagline" "text", "p_bio" "text", "p_gender" "text"[], "p_sexuality" "text"[], "p_birth_year" integer, "p_birth_month" integer, "p_looking_for" "text"[], "p_photos" "uuid"[]) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."update_settings"("p_intro_emails" boolean, "p_message_emails" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_settings"("p_intro_emails" boolean, "p_message_emails" boolean) TO "authenticated";



GRANT ALL ON TABLE "public"."analytics_events" TO "service_role";



GRANT UPDATE ON SEQUENCE "public"."analytics_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."connection_secrets" TO "service_role";
GRANT SELECT ON TABLE "public"."connection_secrets" TO "authenticated";



GRANT ALL ON TABLE "public"."connections" TO "service_role";
GRANT SELECT ON TABLE "public"."connections" TO "authenticated";



GRANT ALL ON TABLE "public"."messages" TO "service_role";
GRANT SELECT ON TABLE "public"."messages" TO "authenticated";



GRANT ALL ON TABLE "public"."terms_acceptances" TO "service_role";
GRANT SELECT ON TABLE "public"."terms_acceptances" TO "authenticated";



GRANT INSERT("version") ON TABLE "public"."terms_acceptances" TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";







