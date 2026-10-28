-- The admin's vetting tool: listing applications and approving them. Admins are profiles in status `admin` (set by hand in Studio). See
-- docs/database.md.

-- Whether the caller is an admin. Unlike require_auth_uid(), it doesn't raise without a signed-in
-- user (it is just false), since the storage policy below calls it.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'admin');
$$;

create or replace function public.require_admin()
returns void
language plpgsql
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

-- The applications waiting for review, oldest first: whole profiles, vetting answers included,
-- so opening one needs no further request.
create or replace function public.admin_list_applications()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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

-- Moves an application from `vetting` to `approved`. Fails for anything not in `vetting`, so an
-- application can't be decided twice.
create or replace function public.admin_approve_application(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  perform public.require_admin();
  update public.profiles set status = 'approved' where id = p_id and status = 'vetting';
  if not found then
    raise exception 'There is no application waiting for review with this id.';
  end if;
end;
$$;

revoke execute on function
  public.is_admin(),
  public.require_admin(),
  public.admin_list_applications(),
  public.admin_approve_application(uuid)
from public, anon, authenticated;

-- is_admin() too, because the storage policy runs as the caller.
grant execute on function
  public.is_admin(),
  public.admin_list_applications(),
  public.admin_approve_application(uuid)
to authenticated;

-- Admins see every photo during vetting (read only).
create policy "photos_select_admin" on storage.objects
  for select to authenticated using (bucket_id = 'photos' and (select public.is_admin()));
