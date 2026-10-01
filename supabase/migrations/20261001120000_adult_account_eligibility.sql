-- Fitly is an adult-only service. Record only the eligibility confirmation,
-- not a member's birth date, and require it before new private media uploads.
-- Existing signed-in beta members confirm on their next authentication.
-- Rollback: create a forward migration that removes the upload checks,
-- confirmation function, and adult_confirmed_at column.

alter table public.profiles
  add column if not exists adult_confirmed_at timestamptz;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, adult_confirmed_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    case
      when new.raw_user_meta_data ->> 'adult_confirmed' = 'true' then now()
      else null
    end
  );
  return new;
end;
$$;

create or replace function public.confirm_adult_status()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
  set adult_confirmed_at = coalesce(adult_confirmed_at, now())
  where id = (select auth.uid());
$$;

revoke all on function public.confirm_adult_status() from public, anon;
grant execute on function public.confirm_adult_status() to authenticated;

drop policy if exists "body_photos_own_all" on public.body_photos;
create policy "body_photos_own_all"
on public.body_photos
for all
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.profiles
    where public.profiles.id = (select auth.uid())
      and public.profiles.adult_confirmed_at is not null
  )
);

drop policy if exists "garments_own_all" on public.garments;
create policy "garments_own_all"
on public.garments
for all
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
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
