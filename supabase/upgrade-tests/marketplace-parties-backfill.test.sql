begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

select is(
  (select count(*) from private.marketplace_parties),
  2::bigint,
  'the upgrade creates exactly one party per legacy participant'
);
select is(
  (select count(distinct user_id) from private.marketplace_parties),
  2::bigint,
  'legacy live-profile links remain unique after backfill'
);
select is(
  (select count(*)
   from public.marketplace_memberships record
   join private.marketplace_parties party
     on party.id = record.party_id and party.user_id = record.user_id),
  2::bigint,
  'legacy memberships are backfilled'
);
select is(
  (select count(*)
   from public.marketplace_credit_accounts record
   join private.marketplace_parties party
     on party.id = record.party_id and party.user_id = record.user_id),
  2::bigint,
  'legacy credit accounts are backfilled'
);
select is(
  (select count(*)
   from public.marketplace_listings record
   join private.marketplace_parties party
     on party.id = record.seller_party_id and party.user_id = record.seller_id),
  2::bigint,
  'legacy listings are backfilled'
);
select is(
  (select count(*)
   from public.marketplace_offers record
   join private.marketplace_parties buyer
     on buyer.id = record.buyer_party_id and buyer.user_id = record.buyer_id
   join private.marketplace_parties seller
     on seller.id = record.seller_party_id and seller.user_id = record.seller_id),
  1::bigint,
  'legacy offers are backfilled for both participants'
);
select is(
  (select count(*)
   from public.marketplace_transactions record
   join private.marketplace_parties buyer
     on buyer.id = record.buyer_party_id and buyer.user_id = record.buyer_id
   join private.marketplace_parties seller
     on seller.id = record.seller_party_id and seller.user_id = record.seller_id),
  1::bigint,
  'legacy transactions are backfilled for both participants'
);
select is(
  (select count(*)
   from private.marketplace_transaction_terms terms
   where terms.transaction_id = '95000000-0000-4000-8000-000000000001'),
  1::bigint,
  'legacy accepted transactions receive one immutable terms snapshot'
);
select is(
  (select count(*)
   from public.marketplace_credit_ledger record
   join private.marketplace_parties party
     on party.id = record.party_id and party.user_id = record.user_id),
  5::bigint,
  'legacy ledger entries are backfilled'
);
select results_eq(
  $$select sum(available_balance)::bigint, sum(reserved_balance)::bigint
    from public.marketplace_credit_accounts$$,
  $$values (375::bigint, 25::bigint)$$,
  'the upgrade preserves existing credit balances exactly'
);
select results_eq(
  $$select sum(delta_available)::bigint, sum(delta_reserved)::bigint
    from public.marketplace_credit_ledger$$,
  $$values (-2147483538::bigint, 2147483672::bigint)$$,
  'the upgrade preserves existing ledger deltas exactly'
);
select is(
  (select count(*) from private.marketplace_ledger_journals
   where idempotency_key = 'legacy:legacy-buyer-boundary-adjustment'),
  1::bigint,
  'signed integer boundary adjustments migrate exactly once'
);
select results_eq(
  $$select count(*)::bigint, sum(posting.units)::bigint
    from private.marketplace_ledger_postings posting
    join private.marketplace_ledger_journals journal on journal.id = posting.journal_id
    where journal.idempotency_key = 'legacy:legacy-buyer-boundary-adjustment'$$,
  $$values (3::bigint, 0::bigint)$$,
  'signed integer boundary adjustments become balanced bigint postings'
);
select is(
  (select count(*)
   from information_schema.columns
   where table_schema = 'public'
     and table_name in (
       'marketplace_memberships',
       'marketplace_credit_accounts',
       'marketplace_listings',
       'marketplace_offers',
       'marketplace_transactions',
       'marketplace_credit_ledger'
     )
     and column_name in ('party_id', 'seller_party_id', 'buyer_party_id')
     and is_nullable = 'NO'),
  8::bigint,
  'every durable party foreign-key column is non-null'
);
select is(
  (select count(*)
   from pg_constraint
   where conname in (
     'marketplace_memberships_party_id_fkey',
     'marketplace_credit_accounts_party_id_fkey',
     'marketplace_listings_seller_party_id_fkey',
     'marketplace_offers_buyer_party_id_fkey',
     'marketplace_offers_seller_party_id_fkey',
     'marketplace_transactions_buyer_party_id_fkey',
     'marketplace_transactions_seller_party_id_fkey',
     'marketplace_credit_ledger_party_id_fkey'
   )
     and confdeltype = 'r'),
  8::bigint,
  'durable party foreign keys restrict destructive history removal'
);
select ok(
  (select bool_and(confdeltype = 'n')
   from pg_constraint
   where conname in (
     'marketplace_memberships_user_id_fkey',
     'marketplace_credit_accounts_user_id_fkey',
     'marketplace_listings_seller_id_fkey',
     'marketplace_offers_buyer_id_fkey',
     'marketplace_offers_seller_id_fkey',
     'marketplace_transactions_buyer_id_fkey',
     'marketplace_transactions_seller_id_fkey',
     'marketplace_credit_ledger_user_id_fkey'
   )),
  'legacy live-profile foreign keys detach with ON DELETE SET NULL'
);

select * from finish();
rollback;
