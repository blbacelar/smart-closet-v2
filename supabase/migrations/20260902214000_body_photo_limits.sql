alter table public.body_photos
  add constraint body_photos_storage_path_owned
  check (storage_path like user_id::text || '/%') not valid;

alter table public.body_photos
  validate constraint body_photos_storage_path_owned;

create unique index body_photos_storage_path_key
  on public.body_photos(storage_path);

create or replace function private.enforce_body_photo_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  photo_limit integer;
  existing_count integer;
begin
  perform 1
  from public.profiles
  where id = new.user_id
  for update;

  select case when tier = 'pro' then 3 else 1 end
  into photo_limit
  from public.profiles
  where id = new.user_id;

  select count(*)
  into existing_count
  from public.body_photos
  where user_id = new.user_id;

  if existing_count >= photo_limit then
    raise exception 'Body photo limit reached for current plan.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_body_photo_limit on public.body_photos;

create trigger enforce_body_photo_limit
  before insert on public.body_photos
  for each row execute procedure private.enforce_body_photo_limit();
