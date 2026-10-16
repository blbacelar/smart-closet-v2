begin;

create extension if not exists pgtap with schema extensions;

select plan(28);

select has_extension('postgis', 'PostGIS is available for coarse marketplace discovery');
select has_table('private', 'marketplace_member_locations', 'member geography is private');
select has_table('private', 'marketplace_listing_locations', 'listing geography is private');
select is(
  has_table_privilege('authenticated', 'private.marketplace_member_locations', 'select'),
  false,
  'members cannot read stored member geography'
);
select is(
  has_table_privilege('authenticated', 'private.marketplace_listing_locations', 'select'),
  false,
  'members cannot read stored listing geography'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.marketplace_listings_nearby(integer,integer,integer,timestamp with time zone,uuid)',
    'execute'
  ),
  true,
  'authenticated members can use nearby discovery'
);
select is(
  has_function_privilege(
    'anon',
    'public.marketplace_listings_nearby(integer,integer,integer,timestamp with time zone,uuid)',
    'execute'
  ),
  false,
  'anonymous callers cannot use nearby discovery'
);
select ok(
  position('latitude' in pg_get_function_result(
    'public.marketplace_listings_nearby(integer,integer,integer,timestamp with time zone,uuid)'::regprocedure
  )) = 0,
  'nearby results do not expose latitude'
);
select ok(
  position('longitude' in pg_get_function_result(
    'public.marketplace_listings_nearby(integer,integer,integer,timestamp with time zone,uuid)'::regprocedure
  )) = 0,
  'nearby results do not expose longitude'
);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000101', 'nearby-viewer@example.com'),
  ('00000000-0000-4000-8000-000000000102', 'nearby-seller-one@example.com'),
  ('00000000-0000-4000-8000-000000000103', 'nearby-seller-two@example.com'),
  ('00000000-0000-4000-8000-000000000104', 'nearby-seller-far@example.com'),
  ('00000000-0000-4000-8000-000000000105', 'nearby-delete@example.com');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', true);
select lives_ok(
  $$select public.marketplace_set_discovery_location(
    49.2827291, -123.1207375, 'Downtown Vancouver', 'device'
  )$$,
  'a member can store a device-derived coarse discovery location'
);
reset role;

select is(
  (select extensions.st_y(coarse_location::extensions.geometry)
   from private.marketplace_member_locations
   where user_id = '00000000-0000-4000-8000-000000000101'),
  49.28::double precision,
  'latitude is quantized to two decimal places before storage'
);
select is(
  (select extensions.st_x(coarse_location::extensions.geometry)
   from private.marketplace_member_locations
   where user_id = '00000000-0000-4000-8000-000000000101'),
  -123.12::double precision,
  'longitude is quantized to two decimal places before storage'
);
select results_eq(
  $$select area_label, source from private.marketplace_member_locations
    where user_id = '00000000-0000-4000-8000-000000000101'$$,
  $$values ('Downtown Vancouver'::text, 'device'::text)$$,
  'only the bounded area label and source accompany coarse geography'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000102', true);
select public.marketplace_set_discovery_location(49.29, -123.12, 'Near area', 'manual');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000103', true);
select public.marketplace_set_discovery_location(49.36, -123.12, 'Edge area', 'manual');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000104', true);
select public.marketplace_set_discovery_location(50.00, -123.00, 'Far area', 'manual');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000105', true);
select public.marketplace_set_discovery_location(49.30, -123.12, 'Delete area', 'manual');
reset role;

insert into public.garments (id, user_id, original_path, image_hash, name, category, status)
values
  ('20000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000101',
   '00000000-0000-4000-8000-000000000101/own.jpg', 'nearby-own', 'Own piece', 'top', 'ready'),
  ('20000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000102',
   '00000000-0000-4000-8000-000000000102/near.jpg', 'nearby-near', 'Near piece', 'top', 'ready'),
  ('20000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000103',
   '00000000-0000-4000-8000-000000000103/edge.jpg', 'nearby-edge', 'Edge piece', 'top', 'ready'),
  ('20000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000104',
   '00000000-0000-4000-8000-000000000104/far.jpg', 'nearby-far', 'Far piece', 'top', 'ready');

insert into public.marketplace_listings (
  id, garment_id, seller_id, accepts_credits, accepts_swap, is_giveaway,
  credit_price, pickup_area, created_at
) values
  ('40000000-0000-4000-8000-000000000101', '20000000-0000-4000-8000-000000000101',
   '00000000-0000-4000-8000-000000000101', false, false, true, null, 'Own area', '2026-10-16 10:00:00+00'),
  ('40000000-0000-4000-8000-000000000102', '20000000-0000-4000-8000-000000000102',
   '00000000-0000-4000-8000-000000000102', false, false, true, null, 'Near area', '2026-10-16 09:00:00+00'),
  ('40000000-0000-4000-8000-000000000103', '20000000-0000-4000-8000-000000000103',
   '00000000-0000-4000-8000-000000000103', false, false, true, null, 'Edge area', '2026-10-16 08:00:00+00'),
  ('40000000-0000-4000-8000-000000000104', '20000000-0000-4000-8000-000000000104',
   '00000000-0000-4000-8000-000000000104', false, false, true, null, 'Far area', '2026-10-16 07:00:00+00');

select is(
  (select count(*) from private.marketplace_listing_locations),
  4::bigint,
  'publishing snapshots the seller coarse location for every listing'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', true);
select results_eq(
  $$select garment_name from public.marketplace_listings_nearby(10, 10, null, null, null)
    order by garment_name$$,
  $$values ('Edge piece'::text), ('Near piece'::text)$$,
  'nearby discovery includes radius matches and excludes own and far listings'
);
select ok(
  (select bool_and(distance_km >= 1 and distance_km <= 10)
   from public.marketplace_listings_nearby(10, 10, null, null, null)),
  'only rounded kilometer distances are returned'
);
select throws_ok(
  $$select * from public.marketplace_listings_nearby(0, 10, null, null, null)$$,
  '22023', 'Radius must be between 1 and 100 kilometres',
  'radius lower bounds are enforced'
);
select throws_ok(
  $$select * from public.marketplace_listings_nearby(101, 10, null, null, null)$$,
  '22023', 'Radius must be between 1 and 100 kilometres',
  'radius upper bounds are enforced'
);
select throws_ok(
  $$select * from public.marketplace_listings_nearby(10, 51, null, null, null)$$,
  '22023', 'Limit must be between 1 and 50',
  'page size bounds are enforced'
);
create temporary table nearby_first_page as
select * from public.marketplace_listings_nearby(10, 1, null, null, null);
select is((select count(*) from nearby_first_page), 1::bigint, 'nearby discovery respects the page size');
select is(
  (select count(*) from public.marketplace_listings_nearby(
    10,
    10,
    (select distance_km from nearby_first_page),
    (select created_at from nearby_first_page),
    (select id from nearby_first_page)
  )),
  1::bigint,
  'the keyset cursor returns the next page without repeating the first row'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000102', true);
select lives_ok(
  $$select public.marketplace_set_discovery_location(50.00, -123.00, 'Relocated area', 'manual')$$,
  'a member can relocate their active listings'
);
reset role;
select is(
  (select extensions.st_y(coarse_location::extensions.geometry)
   from private.marketplace_listing_locations
   where listing_id = '40000000-0000-4000-8000-000000000102'),
  50.00::double precision,
  'relocation updates active listing geography'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000103', true);
select lives_ok(
  $$select public.marketplace_clear_discovery_location()$$,
  'a member can clear discovery geography'
);
reset role;
select is(
  (select count(*) from private.marketplace_listing_locations
   where seller_user_id = '00000000-0000-4000-8000-000000000103'),
  0::bigint,
  'clearing location removes active listing geography'
);

update private.marketplace_member_locations
set updated_at = now() - interval '91 days'
where user_id = '00000000-0000-4000-8000-000000000101';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', true);
select throws_ok(
  $$select * from public.marketplace_listings_nearby(10, 10, null, null, null)$$,
  'P0001', 'Discovery location is missing or stale',
  'stale viewer locations must be refreshed'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000103', true);
select throws_ok(
  $$select * from public.marketplace_listings_nearby(10, 10, null, null, null)$$,
  'P0001', 'Discovery location is missing or stale',
  'missing viewer locations fail without broadening discovery'
);
reset role;

select * from public.account_deletion_start('00000000-0000-4000-8000-000000000105');
select is(
  (select count(*) from private.marketplace_member_locations
   where user_id = '00000000-0000-4000-8000-000000000105'),
  0::bigint,
  'account-deletion start immediately removes private member geography'
);

select * from finish();
rollback;
