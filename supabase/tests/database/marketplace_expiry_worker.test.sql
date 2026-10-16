begin;

create extension if not exists pgtap with schema extensions;

select plan(25);

select has_column('marketplace_offers', 'expired_at', 'offers record their expiry time');
select has_column('marketplace_transactions', 'expired_at', 'transactions record their expiry time');
select has_index(
  'public', 'marketplace_offers', 'marketplace_pending_offer_expiry_idx',
  'pending offer expiry has a partial scan index'
);
select has_index(
  'public', 'marketplace_transactions', 'marketplace_open_handoff_expiry_idx',
  'open handoff expiry has a partial scan index'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.marketplace_expire_stale(timestamp with time zone,integer)',
    'execute'
  ),
  false,
  'members cannot invoke the expiry worker'
);
select ok(
  exists(select 1 from cron.job where jobname = 'fitly-marketplace-expiry'),
  'the expiry worker is scheduled'
);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000051', 'expiry-seller@example.com'),
  ('00000000-0000-4000-8000-000000000052', 'expiry-buyer@example.com'),
  ('00000000-0000-4000-8000-000000000053', 'expiry-swap-seller@example.com'),
  ('00000000-0000-4000-8000-000000000054', 'expiry-swap-buyer@example.com');

insert into public.marketplace_memberships (user_id, expires_at)
values
  ('00000000-0000-4000-8000-000000000051', now() + interval '1 year'),
  ('00000000-0000-4000-8000-000000000052', now() + interval '1 year'),
  ('00000000-0000-4000-8000-000000000053', now() + interval '1 year'),
  ('00000000-0000-4000-8000-000000000054', now() + interval '1 year');

insert into public.marketplace_credit_accounts (user_id, available_balance)
values ('00000000-0000-4000-8000-000000000052', 100);
insert into public.marketplace_credit_ledger (
  user_id, kind, delta_available, idempotency_key, description
) values (
  '00000000-0000-4000-8000-000000000052', 'adjustment', 100,
  'expiry-worker-opening', 'Expiry worker fixture'
);

insert into public.garments (
  id, user_id, original_path, image_hash, name, category, status
) values
  ('20000000-0000-4000-8000-000000000051', '00000000-0000-4000-8000-000000000051',
   '00000000-0000-4000-8000-000000000051/pending.jpg', 'expiry-51-a', 'Pending credit', 'top', 'ready'),
  ('20000000-0000-4000-8000-000000000151', '00000000-0000-4000-8000-000000000051',
   '00000000-0000-4000-8000-000000000051/transaction.jpg', 'expiry-51-b', 'Credit handoff', 'top', 'ready'),
  ('20000000-0000-4000-8000-000000000251', '00000000-0000-4000-8000-000000000051',
   '00000000-0000-4000-8000-000000000051/partial.jpg', 'expiry-51-c', 'Partial handoff', 'top', 'ready'),
  ('20000000-0000-4000-8000-000000000053', '00000000-0000-4000-8000-000000000053',
   '00000000-0000-4000-8000-000000000053/swap-target.jpg', 'expiry-53', 'Swap target', 'top', 'ready'),
  ('20000000-0000-4000-8000-000000000054', '00000000-0000-4000-8000-000000000054',
   '00000000-0000-4000-8000-000000000054/swap-source.jpg', 'expiry-54', 'Swap source', 'top', 'ready'),
  ('20000000-0000-4000-8000-000000000351', '00000000-0000-4000-8000-000000000051',
   '00000000-0000-4000-8000-000000000051/future.jpg', 'expiry-51-d', 'Future offer', 'top', 'ready');

insert into public.marketplace_listings (
  id, garment_id, seller_id, accepts_credits, accepts_swap,
  is_giveaway, credit_price, pickup_area
) values
  ('40000000-0000-4000-8000-000000000051', '20000000-0000-4000-8000-000000000051',
   '00000000-0000-4000-8000-000000000051', true, false, false, 20, 'Expiry area'),
  ('40000000-0000-4000-8000-000000000151', '20000000-0000-4000-8000-000000000151',
   '00000000-0000-4000-8000-000000000051', true, false, false, 30, 'Expiry area'),
  ('40000000-0000-4000-8000-000000000251', '20000000-0000-4000-8000-000000000251',
   '00000000-0000-4000-8000-000000000051', false, false, true, null, 'Expiry area'),
  ('40000000-0000-4000-8000-000000000053', '20000000-0000-4000-8000-000000000053',
   '00000000-0000-4000-8000-000000000053', false, true, false, null, 'Swap area'),
  ('40000000-0000-4000-8000-000000000054', '20000000-0000-4000-8000-000000000054',
   '00000000-0000-4000-8000-000000000054', false, true, false, null, 'Swap area'),
  ('40000000-0000-4000-8000-000000000351', '20000000-0000-4000-8000-000000000351',
   '00000000-0000-4000-8000-000000000051', false, false, true, null, 'Future area');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000052', true);
create temporary table expired_pending_offer as
select public.marketplace_create_offer(
  '40000000-0000-4000-8000-000000000051', 'credits', null, null
) as id;
create temporary table expired_credit_offer as
select public.marketplace_create_offer(
  '40000000-0000-4000-8000-000000000151', 'credits', null, null
) as id;
create temporary table partial_offer as
select public.marketplace_create_offer(
  '40000000-0000-4000-8000-000000000251', 'giveaway', null, null
) as id;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000051', true);
create temporary table expired_credit_transaction as
select public.marketplace_respond_to_offer((select id from expired_credit_offer), true) as id;
create temporary table partial_transaction as
select public.marketplace_respond_to_offer((select id from partial_offer), true) as id;
select is(
  public.marketplace_confirm_handoff((select id from partial_transaction)),
  'awaiting_handoff',
  'one participant can confirm before the deadline'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000054', true);
create temporary table expired_swap_offer as
select public.marketplace_create_offer(
  '40000000-0000-4000-8000-000000000053',
  'swap', '40000000-0000-4000-8000-000000000054', null
) as id;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000053', true);
create temporary table expired_swap_transaction as
select public.marketplace_respond_to_offer((select id from expired_swap_offer), true) as id;
reset role;

update public.marketplace_config
set offer_ttl = interval '30 days', handoff_ttl = interval '30 days'
where id;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000052', true);
create temporary table future_offer as
select public.marketplace_create_offer(
  '40000000-0000-4000-8000-000000000351', 'giveaway', null, null
) as id;
reset role;

update public.marketplace_config
set grants_enabled = false,
    offers_enabled = false,
    acceptance_enabled = false,
    settlement_enabled = false
where id;

create temporary table expiry_result as
select * from public.marketplace_expire_stale(now() + interval '8 days', 100);

select is((select offers_expired from expiry_result), 1, 'one stale pending offer expires');
select is((select transactions_expired from expiry_result), 2, 'credit and swap handoffs expire');
select is((select transactions_disputed from expiry_result), 1, 'partial confirmation is frozen as disputed');
select is(
  (select status from public.marketplace_offers where id = (select id from expired_pending_offer)),
  'expired', 'the stale pending offer is terminal'
);
select ok(
  (select expired_at is not null from public.marketplace_offers
   where id = (select id from expired_pending_offer)),
  'the offer records when it expired'
);
select is(
  (select status from public.marketplace_transactions where id = (select id from expired_credit_transaction)),
  'expired', 'the unconfirmed credit handoff expires'
);
select is(
  (select status from public.marketplace_transactions where id = (select id from partial_transaction)),
  'disputed', 'a partially confirmed handoff is not released'
);
select is(
  (select status from public.marketplace_listings where id = '40000000-0000-4000-8000-000000000251'),
  'reserved', 'a disputed listing stays reserved'
);
select results_eq(
  $$select status from public.marketplace_listings
    where id in (
      '40000000-0000-4000-8000-000000000053',
      '40000000-0000-4000-8000-000000000054'
    ) order by id$$,
  $$values ('active'::text), ('active'::text)$$,
  'both sides of an expired swap are released'
);
select is(
  (select status from public.marketplace_offers where id = (select id from future_offer)),
  'pending', 'an offer before its deadline remains pending'
);
select is(
  (select available_balance from public.marketplace_credit_accounts
   where user_id = '00000000-0000-4000-8000-000000000052'),
  100, 'all expired credit reservations return to available balance'
);
select is(
  (select reserved_balance from public.marketplace_credit_accounts
   where user_id = '00000000-0000-4000-8000-000000000052'),
  0, 'no expired credit remains reserved'
);
select is(
  (select count(*)::integer from public.marketplace_credit_ledger
   where kind = 'expiration_release'),
  1, 'transaction expiry writes one explicit release event'
);
select is(
  (select count(*)::integer from public.marketplace_credit_ledger
   where offer_id = (select id from expired_pending_offer) and kind = 'offer_release'),
  1, 'pending-offer expiry writes one release event'
);

create temporary table expiry_retry as
select * from public.marketplace_expire_stale(now() + interval '8 days', 100);
select is(
  (select offers_expired + transactions_expired + transactions_disputed from expiry_retry),
  0, 'a worker retry has no additional state transitions'
);
select is(
  (select count(*)::integer from public.marketplace_credit_ledger
   where kind = 'expiration_release'),
  1, 'a worker retry cannot duplicate the expiry release'
);

select throws_ok(
  $$select * from public.marketplace_expire_stale(now(), 0)$$,
  '22023', 'Expiry batch limit must be between 1 and 1000',
  'zero is not a valid batch limit'
);
select throws_ok(
  $$select * from public.marketplace_expire_stale(null, 100)$$,
  '22023', 'Expiry cutoff is required',
  'a null cutoff is rejected'
);

select * from finish();
rollback;
