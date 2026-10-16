-- C12: private, coarse PostGIS discovery. Incoming coordinates are snapped to
-- a roughly 1 km grid before storage. Raw coordinates are never retained or
-- returned to marketplace members.

create extension if not exists postgis with schema extensions;

create table private.marketplace_member_locations (
  user_id uuid primary key
    references public.profiles(id) on delete cascade,
  coarse_location extensions.geography(point, 4326) not null,
  area_label text not null check (char_length(trim(area_label)) between 2 and 80),
  source text not null check (source in ('device', 'manual')),
  updated_at timestamptz not null default now()
);

create table private.marketplace_listing_locations (
  listing_id uuid primary key
    references public.marketplace_listings(id) on delete cascade,
  seller_user_id uuid not null
    references public.profiles(id) on delete cascade,
  coarse_location extensions.geography(point, 4326) not null,
  updated_at timestamptz not null default now()
);

create index marketplace_listing_locations_geography_idx
  on private.marketplace_listing_locations using gist (coarse_location);
create index marketplace_listing_locations_seller_idx
  on private.marketplace_listing_locations(seller_user_id, updated_at desc);

revoke all on private.marketplace_member_locations from public, anon, authenticated;
revoke all on private.marketplace_listing_locations from public, anon, authenticated;

create or replace function private.marketplace_purge_location_for_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.marketplace_listing_locations
  where seller_user_id = new.auth_user_id;
  delete from private.marketplace_member_locations
  where user_id = new.auth_user_id;
  return new;
end;
$$;

create trigger marketplace_purge_location_for_deletion
after insert on private.account_deletion_requests
for each row execute function private.marketplace_purge_location_for_deletion();

create or replace function private.marketplace_capture_listing_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' and new.seller_id is not null then
    insert into private.marketplace_listing_locations (
      listing_id, seller_user_id, coarse_location, updated_at
    )
    select new.id, new.seller_id, location.coarse_location, location.updated_at
    from private.marketplace_member_locations location
    where location.user_id = new.seller_id
    on conflict (listing_id) do update
      set seller_user_id = excluded.seller_user_id,
          coarse_location = excluded.coarse_location,
          updated_at = excluded.updated_at;
  else
    delete from private.marketplace_listing_locations
    where listing_id = new.id;
  end if;
  return new;
end;
$$;

create trigger marketplace_capture_listing_location
after insert or update of seller_id, status on public.marketplace_listings
for each row execute function private.marketplace_capture_listing_location();

create or replace function public.marketplace_set_discovery_location(
  p_latitude double precision,
  p_longitude double precision,
  p_area_label text,
  p_source text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_location extensions.geography(point, 4326);
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_latitude is null or not (p_latitude between -90 and 90)
     or p_longitude is null or not (p_longitude between -180 and 180) then
    raise exception 'Invalid discovery coordinates' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_area_label, ''))) not between 2 and 80 then
    raise exception 'Discovery area must be between 2 and 80 characters'
      using errcode = '22023';
  end if;
  if p_source not in ('device', 'manual') then
    raise exception 'Invalid discovery location source' using errcode = '22023';
  end if;

  perform private.account_deletion_lock_subjects(array[v_user_id], '{}'::uuid[]);
  if private.account_deletion_active_request(v_user_id, null) is not null then
    raise exception 'Account deletion in progress';
  end if;

  v_location := extensions.st_setsrid(
    extensions.st_makepoint(
      round(p_longitude::numeric, 2)::double precision,
      round(p_latitude::numeric, 2)::double precision
    ),
    4326
  )::extensions.geography;

  insert into private.marketplace_member_locations (
    user_id, coarse_location, area_label, source, updated_at
  ) values (
    v_user_id, v_location, trim(p_area_label), p_source, now()
  )
  on conflict (user_id) do update
    set coarse_location = excluded.coarse_location,
        area_label = excluded.area_label,
        source = excluded.source,
        updated_at = excluded.updated_at;

  insert into private.marketplace_listing_locations (
    listing_id, seller_user_id, coarse_location, updated_at
  )
  select listing.id, v_user_id, v_location, now()
  from public.marketplace_listings listing
  where listing.seller_id = v_user_id
    and listing.status = 'active'
  on conflict (listing_id) do update
    set seller_user_id = excluded.seller_user_id,
        coarse_location = excluded.coarse_location,
        updated_at = excluded.updated_at;
end;
$$;

create or replace function public.marketplace_clear_discovery_location()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  perform private.account_deletion_lock_subjects(array[v_user_id], '{}'::uuid[]);
  delete from private.marketplace_listing_locations where seller_user_id = v_user_id;
  delete from private.marketplace_member_locations where user_id = v_user_id;
end;
$$;

create or replace function public.marketplace_listings_nearby(
  p_radius_km integer default 25,
  p_limit integer default 24,
  p_cursor_distance_km integer default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  id uuid,
  garment_id uuid,
  seller_id uuid,
  seller_name text,
  status text,
  accepts_credits boolean,
  accepts_swap boolean,
  is_giveaway boolean,
  credit_price integer,
  pickup_area text,
  garment_name text,
  category text,
  color text,
  size text,
  image_path text,
  created_at timestamptz,
  distance_km integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_center extensions.geography(point, 4326);
  v_location_updated_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_radius_km is null or p_radius_km not between 1 and 100 then
    raise exception 'Radius must be between 1 and 100 kilometres' using errcode = '22023';
  end if;
  if p_limit is null or p_limit not between 1 and 50 then
    raise exception 'Limit must be between 1 and 50' using errcode = '22023';
  end if;
  if (p_cursor_distance_km is null or p_cursor_created_at is null or p_cursor_id is null)
     and not (p_cursor_distance_km is null and p_cursor_created_at is null and p_cursor_id is null) then
    raise exception 'A complete nearby cursor is required' using errcode = '22023';
  end if;

  select location.coarse_location, location.updated_at
  into v_center, v_location_updated_at
  from private.marketplace_member_locations location
  where location.user_id = v_user_id;

  if v_center is null or v_location_updated_at < now() - interval '90 days' then
    raise exception 'Discovery location is missing or stale';
  end if;

  return query
  with nearby as (
    select
      listing.id,
      listing.garment_id,
      listing.seller_id,
      coalesce(nullif(trim(profile.display_name), ''), 'Fitly member') as seller_name,
      listing.status,
      listing.accepts_credits,
      listing.accepts_swap,
      listing.is_giveaway,
      listing.credit_price,
      listing.pickup_area,
      coalesce(garment.name, 'Untitled piece') as garment_name,
      garment.category,
      garment.color,
      garment.size,
      coalesce(garment.clean_path, garment.original_path) as image_path,
      listing.created_at,
      greatest(
        1,
        round(extensions.st_distance(location.coarse_location, v_center) / 1000.0)::integer
      ) as distance_km
    from public.marketplace_listings listing
    join private.marketplace_listing_locations location
      on location.listing_id = listing.id
    join public.garments garment on garment.id = listing.garment_id
    join public.profiles profile on profile.id = listing.seller_id
    where listing.status = 'active'
      and listing.seller_id <> v_user_id
      and location.updated_at >= now() - interval '90 days'
      and extensions.st_dwithin(
        location.coarse_location,
        v_center,
        p_radius_km::double precision * 1000.0
      )
  )
  select
    nearby.id,
    nearby.garment_id,
    nearby.seller_id,
    nearby.seller_name,
    nearby.status,
    nearby.accepts_credits,
    nearby.accepts_swap,
    nearby.is_giveaway,
    nearby.credit_price,
    nearby.pickup_area,
    nearby.garment_name,
    nearby.category,
    nearby.color,
    nearby.size,
    nearby.image_path,
    nearby.created_at,
    nearby.distance_km
  from nearby
  where p_cursor_distance_km is null
     or nearby.distance_km > p_cursor_distance_km
     or (
       nearby.distance_km = p_cursor_distance_km
       and nearby.created_at < p_cursor_created_at
     )
     or (
       nearby.distance_km = p_cursor_distance_km
       and nearby.created_at = p_cursor_created_at
       and nearby.id > p_cursor_id
     )
  order by nearby.distance_km, nearby.created_at desc, nearby.id
  limit p_limit;
end;
$$;

revoke all on function private.marketplace_capture_listing_location() from public, anon, authenticated;
revoke all on function private.marketplace_purge_location_for_deletion() from public, anon, authenticated;
revoke all on function public.marketplace_set_discovery_location(double precision, double precision, text, text)
  from public, anon;
revoke all on function public.marketplace_clear_discovery_location() from public, anon;
revoke all on function public.marketplace_listings_nearby(integer, integer, integer, timestamptz, uuid)
  from public, anon;

grant execute on function public.marketplace_set_discovery_location(double precision, double precision, text, text)
  to authenticated;
grant execute on function public.marketplace_clear_discovery_location() to authenticated;
grant execute on function public.marketplace_listings_nearby(integer, integer, integer, timestamptz, uuid)
  to authenticated;

comment on table private.marketplace_member_locations is
  'Server-quantized member discovery geography; never exposed through the Data API.';
comment on table private.marketplace_listing_locations is
  'Private active-listing geography snapshots used only for rounded-distance discovery.';
