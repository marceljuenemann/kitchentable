-- The age check now comes straight after submitting an application, rather than after approval,
-- so an approved applicant can go live without coming back. Applicants approved before their
-- check still go through `approved`. See "Age verification" in docs/database.md.

-- Records a passed age check. An applicant still being vetted stays in `vetting`; an approved one
-- goes live. Returns whether it changed anything: a repeat (Didit retries webhooks), a suspended
-- or deleted profile, or no profile at all is left alone.
create or replace function public.complete_age_verification(p_user_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  update public.profiles
  set status = case when status = 'approved' then 'active' else status end,
      age_verified_at = now()
  where id = p_user_id and status in ('vetting', 'approved') and age_verified_at is null;
  return found;
end;
$$;

-- Approves an application: it goes live if the applicant has passed the age check, and otherwise
-- waits for it in `approved`. Fails for anything not in `vetting`, so an application can't be
-- decided twice.
create or replace function public.admin_approve_application(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
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

-- A profile now goes live from either status.
drop trigger connect_new_member_with_admins on public.profiles;
create trigger connect_new_member_with_admins
  after update of status on public.profiles
  for each row
  when (old.status in ('vetting', 'approved') and new.status = 'active')
  execute function public.connect_new_member_with_admins();

-- Approval emails the applicant whether or not they've passed the age check yet.
drop trigger notify_member_of_approval on public.profiles;
create trigger notify_member_of_approval
  after update of status on public.profiles
  for each row
  when (old.status = 'vetting' and new.status in ('approved', 'active'))
  execute function public.notify_member_of_approval();
