begin;

alter table public.garments
  add constraint garments_original_path_owned
  check (original_path like user_id::text || '/%') not valid;

alter table public.garments
  validate constraint garments_original_path_owned;

create unique index garments_original_path_key
  on public.garments(original_path);

create or replace function private.enforce_garment_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_tier text;
  existing_count integer;
begin
  select tier
  into user_tier
  from public.profiles
  where id = new.user_id
  for update;

  if user_tier = 'free' then
    select count(*)
    into existing_count
    from public.garments
    where user_id = new.user_id;

    if existing_count >= 50 then
      raise exception 'Garment limit reached for current plan.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_garment_limit on public.garments;

create trigger enforce_garment_limit
  before insert on public.garments
  for each row execute procedure private.enforce_garment_limit();

drop policy if exists "garments_own_all" on public.garments;

create policy "garments_select_own"
on public.garments
for select
to authenticated
using ((select auth.uid()) = user_id);

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
  and category is not null
  and coalesce(length(color), 0) <= 40
  and coalesce(length(size), 0) <= 40
  and coalesce(length(season), 0) <= 40
);

create policy "garments_update_own_metadata"
on public.garments
for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and name is not null
  and length(btrim(name)) between 1 and 80
  and category is not null
  and coalesce(length(color), 0) <= 40
  and coalesce(length(size), 0) <= 40
  and coalesce(length(season), 0) <= 40
);

create policy "garments_delete_own"
on public.garments
for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke update on public.garments from authenticated;
grant update(name, category, color, size, season) on public.garments to authenticated;

drop policy if exists "private_image_insert" on storage.objects;
drop policy if exists "private_image_update" on storage.objects;

create policy "private_source_image_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('body', 'garments')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

commit;
