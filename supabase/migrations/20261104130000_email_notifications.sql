-- Emails members about new intros and new messages, at most one of each kind at a time and less
-- often the longer they stay away. See "Email notifications" in docs/database.md.

alter table public.profiles
  -- When the user was last emailed about each kind; null until the first.
  add column intros_emailed_at timestamptz,
  add column messages_emailed_at timestamptz;

-- Whether an email of a kind is due, given when the last one of that kind went out (null if none
-- has), when the user last read anything, and the earliest thing of that kind that arrived since
-- the last email: it has waited 15 minutes (so people using the app aren't emailed), and unless
-- the user has read anything since the last email, the wait since it is as long as they'd been
-- away when it went out, at least 1 day and at most 14. Each unanswered email so doubles the wait.
create or replace function public.email_notification_due(
  p_emailed timestamptz,
  p_read timestamptz,
  p_first_new timestamptz
)
returns boolean
language sql
stable
set search_path = public
as $$
  select p_first_new <= now() - interval '15 minutes'
    and (
      p_emailed is null
      or p_read >= p_emailed
      or now() - p_emailed >= least(greatest(p_emailed - p_read, interval '1 day'), interval '14 days')
    );
$$;

-- When the user last read anything: their latest read watermark, or when their profile was
-- created if they've never opened a conversation.
create or replace function public.last_read_at(p_profile public.profiles)
returns timestamptz
language sql
stable
set search_path = public
as $$
  select coalesce(max(last_read_at), p_profile.created_at)
  from public.connection_secrets
  where user_id = p_profile.id;
$$;

-- Sends the intro and message emails that are due, and notes when. Run by pg_cron every 10
-- minutes. Only members whose profile is live (and the admins) get them, and only the kinds
-- they haven't switched off.
create or replace function public.send_email_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
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

revoke execute on function
  public.email_notification_due(timestamptz, timestamptz, timestamptz),
  public.last_read_at(public.profiles),
  public.send_email_notifications()
from public, anon, authenticated;
-- For the e2e tests, which run the job rather than wait for it.
grant execute on function public.send_email_notifications() to service_role;

select cron.schedule(
  'send-email-notifications',
  '*/10 * * * *',
  $$select public.send_email_notifications()$$
);
