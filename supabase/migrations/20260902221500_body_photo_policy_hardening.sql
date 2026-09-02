drop policy if exists "body_photos_own_all" on public.body_photos;

create policy "body_photos_select_own"
on public.body_photos
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "body_photos_insert_own_pending"
on public.body_photos
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'pending'
  and reject_reason is null
);

create policy "body_photos_delete_own"
on public.body_photos
for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke update on public.profiles from authenticated;
grant update(display_name, region) on public.profiles to authenticated;
