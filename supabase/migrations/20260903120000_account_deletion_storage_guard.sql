-- A deleted user's access token can remain valid until its JWT expires. Require
-- a live application profile for every private storage operation so that the
-- auth.users -> profiles deletion cascade closes that stale-token window.
--
-- Rollback: create a new forward migration that restores the previous policies.

drop policy if exists "private_image_insert" on storage.objects;
drop policy if exists "private_image_select" on storage.objects;
drop policy if exists "private_image_update" on storage.objects;
drop policy if exists "private_image_delete" on storage.objects;

create policy "private_image_insert" on storage.objects for insert to authenticated
with check (
  bucket_id in ('body', 'garments', 'results')
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.profiles
    where public.profiles.id = (select auth.uid())
  )
);

create policy "private_image_select" on storage.objects for select to authenticated
using (
  bucket_id in ('body', 'garments', 'results')
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.profiles
    where public.profiles.id = (select auth.uid())
  )
);

create policy "private_image_update" on storage.objects for update to authenticated
using (
  bucket_id in ('body', 'garments', 'results')
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.profiles
    where public.profiles.id = (select auth.uid())
  )
)
with check (
  bucket_id in ('body', 'garments', 'results')
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.profiles
    where public.profiles.id = (select auth.uid())
  )
);

create policy "private_image_delete" on storage.objects for delete to authenticated
using (
  bucket_id in ('body', 'garments', 'results')
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.profiles
    where public.profiles.id = (select auth.uid())
  )
);
