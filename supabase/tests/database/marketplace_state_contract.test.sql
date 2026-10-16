begin;

create extension if not exists pgtap with schema extensions;

select plan(28);

select has_table('private', 'marketplace_transaction_terms', 'accepted terms have a restricted snapshot');
select is(
  has_table_privilege('authenticated', 'private.marketplace_transaction_terms', 'select'),
  false,
  'members cannot read raw retained terms'
);
select has_column('marketplace_config', 'grants_enabled', 'grants have an independent switch');
select has_column('marketplace_config', 'offers_enabled', 'offers have an independent switch');
select has_column('marketplace_config', 'acceptance_enabled', 'acceptance has an independent switch');
select has_column('marketplace_config', 'settlement_enabled', 'settlement has an independent switch');
select has_column('marketplace_offers', 'expires_at', 'offers carry a server deadline');
select has_column('marketplace_transactions', 'handoff_deadline', 'handoffs carry a server deadline');

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000031', 'state-seller@example.com'),
  ('00000000-0000-4000-8000-000000000032', 'state-buyer@example.com'),
  ('00000000-0000-4000-8000-000000000033', 'state-deleting@example.com'),
  ('00000000-0000-4000-8000-000000000034', 'state-grant@example.com');

insert into public.marketplace_memberships (user_id, expires_at)
values
  ('00000000-0000-4000-8000-000000000031', now() + interval '1 year'),
  ('00000000-0000-4000-8000-000000000032', now() + interval '1 year');
insert into public.marketplace_credit_accounts (user_id, available_balance)
values ('00000000-0000-4000-8000-000000000032', 100);
insert into public.marketplace_credit_ledger (
  user_id, kind, delta_available, idempotency_key, description
) values (
  '00000000-0000-4000-8000-000000000032', 'adjustment', 100,
  'state-contract-opening', 'State contract fixture'
);

insert into public.garments (id, user_id, original_path, image_hash, name, category, status)
values
  ('20000000-0000-4000-8000-000000000031', '00000000-0000-4000-8000-000000000031',
   '00000000-0000-4000-8000-000000000031/one.jpg', 'state-31-1', 'Target one', 'top', 'ready'),
  ('20000000-0000-4000-8000-000000000131', '00000000-0000-4000-8000-000000000031',
   '00000000-0000-4000-8000-000000000031/two.jpg', 'state-31-2', 'Target two', 'top', 'ready'),
  ('20000000-0000-4000-8000-000000000231', '00000000-0000-4000-8000-000000000031',
   '00000000-0000-4000-8000-000000000031/three.jpg', 'state-31-3', 'Target three', 'top', 'ready'),
  ('20000000-0000-4000-8000-000000000032', '00000000-0000-4000-8000-000000000032',
   '00000000-0000-4000-8000-000000000032/swap.jpg', 'state-32', 'Buyer piece', 'top', 'ready'),
  ('20000000-0000-4000-8000-000000000033', '00000000-0000-4000-8000-000000000033',
   '00000000-0000-4000-8000-000000000033/delete.jpg', 'state-33', 'Deleting piece', 'top', 'ready');

insert into public.marketplace_listings (
  id, garment_id, seller_id, accepts_credits, accepts_swap, is_giveaway,
  credit_price, pickup_area
) values
  ('40000000-0000-4000-8000-000000000031', '20000000-0000-4000-8000-000000000031',
   '00000000-0000-4000-8000-000000000031', true, false, false, 25, 'State area'),
  ('40000000-0000-4000-8000-000000000131', '20000000-0000-4000-8000-000000000131',
   '00000000-0000-4000-8000-000000000031', false, false, true, null, 'State area'),
  ('40000000-0000-4000-8000-000000000231', '20000000-0000-4000-8000-000000000231',
   '00000000-0000-4000-8000-000000000031', false, false, true, null, 'State area'),
  ('40000000-0000-4000-8000-000000000032', '20000000-0000-4000-8000-000000000032',
   '00000000-0000-4000-8000-000000000032', false, true, false, null, 'Buyer area'),
  ('40000000-0000-4000-8000-000000000033', '20000000-0000-4000-8000-000000000033',
   '00000000-0000-4000-8000-000000000033', false, false, true, null, 'Delete area');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000032', true);
create temporary table state_offer_one as
select public.marketplace_create_offer(
  '40000000-0000-4000-8000-000000000031', 'credits', null, 'Private note'
) as id;
select ok(
  (select expires_at > created_at and expires_at <= created_at + interval '30 days'
   from public.marketplace_offers where id = (select id from state_offer_one)),
  'offer expiry is assigned by the server policy'
);
select results_eq(
  $$select available_balance, reserved_balance from public.marketplace_credit_accounts
    where user_id = '00000000-0000-4000-8000-000000000032'$$,
  $$values (75, 25)$$,
  'credit offers reserve value exactly once'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000031', true);
create temporary table state_transaction as
select public.marketplace_respond_to_offer((select id from state_offer_one), true) as id;
select isnt((select id from state_transaction), null::uuid, 'seller acceptance creates a transaction');
select ok(
  (select handoff_deadline > accepted_at
   from public.marketplace_transactions where id = (select id from state_transaction)),
  'accepted handoffs receive an immutable future deadline'
);
reset role;
select is(
  (select count(*) from private.marketplace_transaction_terms
   where transaction_id = (select id from state_transaction)),
  1::bigint,
  'acceptance captures one terms snapshot'
);
select is(
  (select count(*) from information_schema.columns
   where table_schema = 'private' and table_name = 'marketplace_transaction_terms'
     and column_name in ('image_path', 'message', 'pickup_area')),
  0::bigint,
  'terms snapshots exclude media, private chat, and location'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000031', true);
select is(
  public.marketplace_respond_to_offer((select id from state_offer_one), true),
  (select id from state_transaction),
  'acceptance retries return the original transaction'
);
reset role;

select throws_ok(
  format('update private.marketplace_transaction_terms set terms_version = %L where transaction_id = %L',
    'changed', (select id from state_transaction)),
  'P0001', 'Marketplace transaction terms are immutable',
  'accepted terms cannot be rewritten'
);
select throws_ok(
  format('update public.marketplace_offers set status = %L where id = %L',
    'pending', (select id from state_offer_one)),
  'P0001', 'Invalid marketplace offer transition',
  'accepted offers cannot return to pending'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000032', true);
create temporary table state_offer_two as
select public.marketplace_create_offer(
  '40000000-0000-4000-8000-000000000131', 'giveaway', null, null
) as id;
reset role;
update public.marketplace_config set offers_enabled = false where id;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000032', true);
select throws_ok(
  $$select public.marketplace_create_offer(
      '40000000-0000-4000-8000-000000000231', 'giveaway', null, null
    )$$,
  'P0001', 'Marketplace offer creation is paused',
  'offer creation switch is enforced server-side'
);
select lives_ok(
  format('select public.marketplace_withdraw_offer(%L)', (select id from state_offer_two)),
  'a member can withdraw an existing offer while creation is paused'
);
reset role;

update public.marketplace_config set offers_enabled = true where id;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000032', true);
create temporary table state_offer_three as
select public.marketplace_create_offer(
  '40000000-0000-4000-8000-000000000231', 'giveaway', null, null
) as id;
reset role;
update public.marketplace_config set acceptance_enabled = false where id;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000031', true);
select throws_ok(
  format('select public.marketplace_respond_to_offer(%L, true)', (select id from state_offer_three)),
  'P0001', 'Marketplace acceptance is paused',
  'acceptance switch blocks new obligations'
);
select is(
  public.marketplace_respond_to_offer((select id from state_offer_three), false),
  null::uuid,
  'sellers can still reject safely while acceptance is paused'
);
reset role;

update public.marketplace_config set acceptance_enabled = true, settlement_enabled = false where id;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000032', true);
select throws_ok(
  format('select public.marketplace_confirm_handoff(%L)', (select id from state_transaction)),
  'P0001', 'Marketplace settlement is paused',
  'settlement switch freezes handoff confirmation'
);
reset role;
update public.marketplace_config set transactions_enabled = false where id;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000032', true);
select lives_ok(
  format('select public.marketplace_cancel_transaction(%L)', (select id from state_transaction)),
  'safe cancellation remains available under the master kill switch'
);
select is(
  (select status from public.marketplace_transactions where id = (select id from state_transaction)),
  'cancelled',
  'safe cancellation reaches a terminal state'
);
select throws_ok(
  $$select public.marketplace_publish_listing(
      '20000000-0000-4000-8000-000000000032', false, true, false, null, 'Changed area'
    )$$,
  'P0001', 'Marketplace transactions are paused',
  'the master switch blocks new or edited listings'
);
select is(
  (select count(*) from public.marketplace_my_transactions()
   where id = (select id from state_transaction)),
  1::bigint,
  'history remains readable while transactions are paused'
);
reset role;

update public.marketplace_config
set transactions_enabled = true, settlement_enabled = true, grants_enabled = false
where id;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000034', true);
select throws_ok(
  $$select * from public.marketplace_activate_membership()$$,
  'P0001', 'Marketplace grants are paused',
  'grant switch blocks development issuance'
);
reset role;

update public.marketplace_config set grants_enabled = true where id;
create temporary table deleting_state_request as
select * from public.account_deletion_start('00000000-0000-4000-8000-000000000033');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000032', true);
select throws_ok(
  $$select public.marketplace_create_offer(
      '40000000-0000-4000-8000-000000000033', 'giveaway', null, null
    )$$,
  'P0001', 'Account deletion in progress',
  'offer creation cannot race a seller deletion tombstone'
);
reset role;

select * from finish();
rollback;
