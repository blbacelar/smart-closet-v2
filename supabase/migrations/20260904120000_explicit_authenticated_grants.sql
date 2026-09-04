-- Make Data API privileges reproducible on fresh projects where automatic
-- exposure is disabled, then let RLS decide which owner rows are visible.
-- This also restores the source-only Storage write boundary after the live
-- profile guard migration accidentally reintroduced result uploads/updates.
--
-- Rollback: create a new forward migration that explicitly restores the
-- previous grants and Storage policies if the client contract changes.

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.body_photos from anon, authenticated;
revoke all on table public.garments from anon, authenticated;
revoke all on table public.usage_daily from anon, authenticated;
revoke all on table public.tryon_jobs from anon, authenticated;
revoke all on table public.ai_cost_ledger from anon, authenticated;

grant select on table public.profiles to authenticated;
grant update(display_name, region) on table public.profiles to authenticated;

grant select, insert, delete on table public.body_photos to authenticated;

grant select, insert, delete on table public.garments to authenticated;
grant update(name, category, color, size, season) on table public.garments to authenticated;

grant select on table public.usage_daily to authenticated;

grant select on table public.tryon_jobs to authenticated;
grant update(feedback) on table public.tryon_jobs to authenticated;

drop policy if exists "private_image_insert" on storage.objects;
drop policy if exists "private_source_image_insert" on storage.objects;
drop policy if exists "private_image_update" on storage.objects;

create policy "private_source_image_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('body', 'garments')
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.profiles
    where public.profiles.id = (select auth.uid())
  )
);
