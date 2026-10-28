-- Age verification: once Didit confirms an approved applicant is 18 or over, the didit-webhook
-- edge function activates their profile. See "Age verification" in docs/database.md.

-- When the user passed the age check. Kept after the status moves on (hidden, suspended), as the
-- record the Privacy Policy describes: whether they passed, and when.
alter table public.profiles add column age_verified_at timestamptz;

-- Moves a profile from `approved` to `active` and records the check; returns whether it did.
-- Anything else is left alone: an already active profile (Didit retries webhooks), a suspended
-- or deleted one, or no profile at all.
create or replace function public.complete_age_verification(p_user_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  update public.profiles set status = 'active', age_verified_at = now()
  where id = p_user_id and status = 'approved';
  return found;
end;
$$;

-- Only the webhook calls it, with the service role. Users never do: the webhook has checked that
-- the result comes from Didit.
revoke execute on function public.complete_age_verification(uuid) from public, anon, authenticated;
grant execute on function public.complete_age_verification(uuid) to service_role;
