-- Members can see each other's photos. See "Access and privacy" in docs/photos.md.

-- Whether a file in the `photos` bucket is a photo on a live profile, and the caller is a live
-- member. Only photos listed on the profile count, so files uploaded but never submitted stay
-- private. Which members may see whom is up to search_profiles(): this only checks the statuses.
-- Admins have photos_select_admin.
create or replace function public.is_member_photo(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'active')
    and exists (
      select 1 from public.profiles p
      where p.id::text = (storage.foldername(p_name))[1]
        and p.status = 'active'
        and (storage.foldername(p_name))[2] = any (p.photos::text[])
    );
$$;

revoke execute on function public.is_member_photo(text) from public, anon, authenticated;
-- For the storage policy below, which runs as the caller.
grant execute on function public.is_member_photo(text) to authenticated;

-- Signing only. Listing the bucket needs the same SELECT, and would hand any member every member's
-- user id and photo ids, including those of people who hide from them. Not having those ids is
-- what keeps these people out of reach, so members get them only from search_profiles() and
-- get_connected_profiles().
create policy "photos_select_members" on storage.objects
  for select to authenticated using (
    bucket_id = 'photos'
    and storage.operation() in ('storage.object.sign', 'storage.object.sign_many')
    and public.is_member_photo(name)
  );
