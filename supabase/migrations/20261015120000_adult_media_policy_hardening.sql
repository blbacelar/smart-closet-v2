-- Remove permissive adult-eligibility policies that were added alongside the
-- earlier operation-specific policies. PostgreSQL combines permissive
-- policies with OR, so the broad policies could bypass pending/processing
-- constraints. Require adult confirmation directly in each insert policy.
--
-- Rollback: use a forward migration that restores the prior policies only if
-- the product no longer requires adult confirmation for private media.

drop policy if exists "body_photos_own_all" on public.body_photos;
drop policy if exists "body_photos_insert_own_pending" on public.body_photos;

create policy "body_photos_insert_own_pending"
on public.body_photos
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'pending'
  and reject_reason is null
  and exists (
    select 1
    from public.profiles
    where public.profiles.id = (select auth.uid())
      and public.profiles.adult_confirmed_at is not null
  )
);

drop policy if exists "garments_own_all" on public.garments;
drop policy if exists "garments_insert_own_processing" on public.garments;

create policy "garments_insert_own_processing"
on public.garments
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'processing'
  and clean_path is null
  and image_hash is null
  and name is not null
  and length(btrim(name)) between 1 and 80
  and (category is null or category in ('top', 'bottom', 'dress', 'outerwear', 'shoes'))
  and coalesce(length(color), 0) <= 40
  and coalesce(length(size), 0) <= 40
  and coalesce(length(season), 0) <= 40
  and exists (
    select 1
    from public.profiles
    where public.profiles.id = (select auth.uid())
      and public.profiles.adult_confirmed_at is not null
  )
);

drop policy if exists "private_source_image_insert" on storage.objects;

create policy "private_source_image_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('body', 'garments')
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.profiles
    where public.profiles.id = (select auth.uid())
      and public.profiles.adult_confirmed_at is not null
  )
);
