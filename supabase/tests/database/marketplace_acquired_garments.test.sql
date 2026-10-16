begin;

create extension if not exists pgtap with schema extensions;

select plan(29);

select has_table('private', 'marketplace_acquisitions', 'acquisition provenance is private');
select is(
  has_table_privilege('authenticated', 'private.marketplace_acquisitions', 'select'),
  false,
  'members cannot read retained acquisition provenance'
);
select is(
  has_function_privilege('authenticated', 'public.marketplace_finalize_handoff(uuid)', 'execute'),
  false,
  'members cannot invoke the service finalizer directly'
);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000071', 'acquisition-seller@example.com'),
  ('00000000-0000-4000-8000-000000000072', 'acquisition-buyer@example.com');
insert into public.marketplace_memberships (user_id, expires_at) values
  ('00000000-0000-4000-8000-000000000071', now() + interval '1 year'),
  ('00000000-0000-4000-8000-000000000072', now() + interval '1 year');
insert into public.marketplace_credit_accounts (user_id, available_balance)
values ('00000000-0000-4000-8000-000000000072', 100);
insert into public.marketplace_credit_ledger (
  user_id, kind, delta_available, idempotency_key, description
) values (
  '00000000-0000-4000-8000-000000000072', 'adjustment', 100,
  'acquisition-opening', 'Acquisition fixture'
);

insert into public.garments (
  id, user_id, original_path, clean_path, image_hash, name,
  category, color, size, season, status
) values
  ('20000000-0000-4000-8000-000000000071', '00000000-0000-4000-8000-000000000071',
   '00000000-0000-4000-8000-000000000071/credit-original.jpg',
   '00000000-0000-4000-8000-000000000071/credit-clean.png',
   'private-credit-hash', 'Credit coat', 'outerwear', 'Blue', 'M', 'Winter', 'ready'),
  ('20000000-0000-4000-8000-000000000171', '00000000-0000-4000-8000-000000000071',
   '00000000-0000-4000-8000-000000000071/giveaway.jpg', null,
   'private-giveaway-hash', 'Giveaway top', 'top', 'White', 'S', 'Summer', 'ready'),
  ('20000000-0000-4000-8000-000000000271', '00000000-0000-4000-8000-000000000071',
   '00000000-0000-4000-8000-000000000071/swap-target.jpg', null,
   'private-swap-target-hash', 'Seller swap dress', 'dress', 'Red', 'M', 'Summer', 'ready'),
  ('20000000-0000-4000-8000-000000000371', '00000000-0000-4000-8000-000000000071',
   '00000000-0000-4000-8000-000000000071/missing.jpg', null,
   'private-missing-hash', 'Missing copy top', 'top', 'Black', 'L', 'Fall', 'ready'),
  ('20000000-0000-4000-8000-000000000072', '00000000-0000-4000-8000-000000000072',
   '00000000-0000-4000-8000-000000000072/swap-offer.jpg', null,
   'private-swap-offer-hash', 'Buyer swap shoes', 'shoes', 'Brown', '9', 'All', 'ready');

insert into public.marketplace_listings (
  id, garment_id, seller_id, accepts_credits, accepts_swap,
  is_giveaway, credit_price, pickup_area
) values
  ('40000000-0000-4000-8000-000000000071', '20000000-0000-4000-8000-000000000071',
   '00000000-0000-4000-8000-000000000071', true, false, false, 25, 'Acquisition area'),
  ('40000000-0000-4000-8000-000000000171', '20000000-0000-4000-8000-000000000171',
   '00000000-0000-4000-8000-000000000071', false, false, true, null, 'Acquisition area'),
  ('40000000-0000-4000-8000-000000000271', '20000000-0000-4000-8000-000000000271',
   '00000000-0000-4000-8000-000000000071', false, true, false, null, 'Acquisition area'),
  ('40000000-0000-4000-8000-000000000371', '20000000-0000-4000-8000-000000000371',
   '00000000-0000-4000-8000-000000000071', false, false, true, null, 'Acquisition area'),
  ('40000000-0000-4000-8000-000000000072', '20000000-0000-4000-8000-000000000072',
   '00000000-0000-4000-8000-000000000072', false, true, false, null, 'Buyer area');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000072', true);
create temporary table acquisition_offers as
select 'credits' mode, public.marketplace_create_offer(
  '40000000-0000-4000-8000-000000000071', 'credits', null, null
) id
union all select 'giveaway', public.marketplace_create_offer(
  '40000000-0000-4000-8000-000000000171', 'giveaway', null, null
)
union all select 'swap', public.marketplace_create_offer(
  '40000000-0000-4000-8000-000000000271', 'swap',
  '40000000-0000-4000-8000-000000000072', null
)
union all select 'missing', public.marketplace_create_offer(
  '40000000-0000-4000-8000-000000000371', 'giveaway', null, null
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000071', true);
create temporary table acquisition_transactions as
select offer.mode, public.marketplace_respond_to_offer(offer.id, true) id
from acquisition_offers offer;
select is(
  public.marketplace_confirm_handoff((select id from acquisition_transactions where mode = 'credits')),
  'awaiting_handoff',
  'the first participant confirmation does not settle'
);
select public.marketplace_confirm_handoff(id)
from acquisition_transactions where mode <> 'credits';
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000072', true);
select is(
  public.marketplace_confirm_handoff((select id from acquisition_transactions where mode = 'credits')),
  'settlement_pending',
  'the second confirmation prepares storage-copy settlement'
);
select public.marketplace_confirm_handoff(id)
from acquisition_transactions where mode <> 'credits';
reset role;

select is(
  (select count(*) from private.marketplace_acquisitions),
  5::bigint,
  'credit, giveaway and missing transactions prepare one copy while swap prepares two'
);
select is(
  (select count(*) from private.marketplace_acquisitions acquisition
   join acquisition_transactions transaction_record
     on transaction_record.id = acquisition.transaction_id
   where transaction_record.mode = 'swap'),
  2::bigint,
  'swap prepares both recipient directions exactly once'
);

insert into storage.objects (id, bucket_id, name)
select gen_random_uuid(), 'garments', manifest.destination_original_path
from acquisition_transactions transaction_record
cross join lateral public.marketplace_acquisition_manifest(transaction_record.id) manifest
where transaction_record.mode <> 'missing';
insert into storage.objects (id, bucket_id, name)
select gen_random_uuid(), 'garments', manifest.destination_clean_path
from acquisition_transactions transaction_record
cross join lateral public.marketplace_acquisition_manifest(transaction_record.id) manifest
where transaction_record.mode <> 'missing'
  and manifest.destination_clean_path is not null;

select is(
  public.marketplace_finalize_handoff((select id from acquisition_transactions where mode = 'credits')),
  'completed', 'credit settlement completes after storage copies exist'
);
select is(
  public.marketplace_finalize_handoff((select id from acquisition_transactions where mode = 'giveaway')),
  'completed', 'giveaway settlement completes after storage copies exist'
);
select is(
  public.marketplace_finalize_handoff((select id from acquisition_transactions where mode = 'swap')),
  'completed', 'swap settlement completes after both storage-copy directions exist'
);
select throws_ok(
  format('select public.marketplace_finalize_handoff(%L)',
    (select id from acquisition_transactions where mode = 'missing')),
  'P0001', 'Acquired garment storage copy is incomplete',
  'settlement cannot complete before its recipient-owned object exists'
);
select is(
  (select status from public.marketplace_transactions
   where id = (select id from acquisition_transactions where mode = 'missing')),
  'awaiting_handoff', 'a missing copy leaves value and state frozen for retry'
);
select is(
  (select count(*) from public.garments garment
   join private.marketplace_acquisitions acquisition
     on acquisition.acquired_garment_id = garment.id),
  4::bigint, 'three completed modes create four recipient closet garments'
);
select is(
  (select count(*) from private.marketplace_acquisitions where completed_at is not null),
  4::bigint, 'completed provenance is recorded once per recipient copy'
);
select is(
  (select count(*) from public.garments garment
   join private.marketplace_acquisitions acquisition
     on acquisition.acquired_garment_id = garment.id
   where garment.original_path like garment.user_id::text || '/acquired/%'),
  4::bigint, 'every acquired object path belongs to its recipient namespace'
);
select is(
  (select count(*) from public.garments garment
   join private.marketplace_acquisitions acquisition
     on acquisition.acquired_garment_id = garment.id
   where garment.image_hash is null
     and garment.processing_attempts = 0
     and garment.processing_error is null),
  4::bigint, 'private processing fingerprints and failures are not copied'
);
select is(
  (select count(*) from private.marketplace_acquisitions acquisition
   join public.marketplace_listings listing on listing.id = acquisition.source_listing_id
   join public.garments source on source.id = listing.garment_id
   join public.garments acquired on acquired.id = acquisition.acquired_garment_id
   where (source.name, source.category, source.color, source.size, source.season)
      is not distinct from
     (acquired.name, acquired.category, acquired.color, acquired.size, acquired.season)),
  4::bigint, 'only closet-safe descriptive metadata is copied'
);
select is(
  (select count(*) from public.garments
   where id in (
     '20000000-0000-4000-8000-000000000071',
     '20000000-0000-4000-8000-000000000171',
     '20000000-0000-4000-8000-000000000271',
     '20000000-0000-4000-8000-000000000072'
   ) and user_id in (
     '00000000-0000-4000-8000-000000000071',
     '00000000-0000-4000-8000-000000000072'
   )),
  4::bigint, 'source garment ownership is never reassigned'
);
select is(
  (select count(*) from public.garments
   where id in (
     '20000000-0000-4000-8000-000000000071',
     '20000000-0000-4000-8000-000000000171',
     '20000000-0000-4000-8000-000000000271',
     '20000000-0000-4000-8000-000000000072'
   ) and marketplace_archived_at is not null),
  4::bigint, 'completed source garments are archived'
);
select is(
  (select count(*) from public.garments garment
   join private.marketplace_acquisitions acquisition
     on acquisition.acquired_garment_id = garment.id
   where garment.marketplace_archived_at is null),
  4::bigint, 'recipient copies are visible in their closets'
);
select results_eq(
  $$select available_balance, reserved_balance
    from public.marketplace_credit_accounts
    where user_id = '00000000-0000-4000-8000-000000000072'$$,
  $$values (75, 0)$$,
  'credit settlement releases the buyer hold exactly once'
);
select results_eq(
  $$select available_balance, reserved_balance
    from public.marketplace_credit_accounts
    where user_id = '00000000-0000-4000-8000-000000000071'$$,
  $$values (25, 0)$$,
  'credit settlement pays the seller exactly once'
);
select is(
  (select count(*) from public.marketplace_credit_ledger
   where kind in ('transfer_out', 'transfer_in')),
  2::bigint, 'one credit handoff creates one balanced transfer pair'
);
select is(
  (select count(*) from public.marketplace_listings where status = 'completed'),
  4::bigint, 'completed modes close every transferred listing including both swap sides'
);
select is(
  public.marketplace_finalize_handoff((select id from acquisition_transactions where mode = 'credits')),
  'completed', 'a finalizer retry returns the existing terminal state'
);
select is(
  (select count(*) from public.garments garment
   join private.marketplace_acquisitions acquisition
     on acquisition.acquired_garment_id = garment.id),
  4::bigint, 'a finalizer retry cannot duplicate acquired garments'
);
select is(
  (select count(*) from public.marketplace_credit_ledger
   where kind in ('transfer_out', 'transfer_in')),
  2::bigint, 'a finalizer retry cannot duplicate credit transfer events'
);
select is(
  (select count(*) from public.marketplace_acquisition_reconciliation()),
  0::bigint, 'completed acquisitions reconcile without anomalies'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000072', true);
select throws_ok(
  format('select public.marketplace_finalize_handoff(%L)',
    (select id from acquisition_transactions where mode = 'credits')),
  '42501', null,
  'an authenticated client cannot bypass the edge settlement boundary'
);
reset role;

select * from finish();
rollback;
