begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

select is(
  (select count(*) from public.marketplace_transactions
   where listing_id = '40000000-0000-4000-8000-000000000035'),
  1::bigint,
  'competing acceptance creates exactly one transaction'
);
select is(
  (select count(*) from public.marketplace_offers
   where listing_id = '40000000-0000-4000-8000-000000000035'
     and status = 'accepted'),
  1::bigint,
  'one competing offer wins acceptance'
);
select is(
  (select count(*) from public.marketplace_offers
   where listing_id = '40000000-0000-4000-8000-000000000035'
     and status = 'superseded'),
  1::bigint,
  'the losing offer is released into a terminal state'
);
select is(
  (select count(*) from private.marketplace_transaction_terms terms
   join public.marketplace_transactions transaction_record
     on transaction_record.id = terms.transaction_id
   where transaction_record.listing_id = '40000000-0000-4000-8000-000000000035'),
  1::bigint,
  'the winning transaction owns exactly one terms snapshot'
);

select * from finish();
rollback;
