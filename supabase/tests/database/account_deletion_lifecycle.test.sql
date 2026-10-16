begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

select has_table('private', 'account_deletion_requests', 'deletion tombstones are restricted records');
select has_table('private', 'account_deletion_checkpoints', 'deletion progress has durable checkpoints');
select is(
  has_table_privilege('authenticated', 'private.account_deletion_requests', 'select'),
  false,
  'members cannot read deletion tombstones'
);
select is(
  has_function_privilege('authenticated', 'public.account_deletion_start(uuid)', 'execute'),
  false,
  'members cannot invoke service deletion orchestration directly'
);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000020', 'delete-one@example.com'),
  ('00000000-0000-4000-8000-000000000021', 'delete-blocked@example.com'),
  ('00000000-0000-4000-8000-000000000022', 'delete-counterparty@example.com');

insert into public.body_photos (id, user_id, storage_path, status)
values (
  '10000000-0000-4000-8000-000000000020',
  '00000000-0000-4000-8000-000000000020',
  '00000000-0000-4000-8000-000000000020/body.jpg',
  'approved'
);
insert into public.garments (
  id, user_id, original_path, clean_path, image_hash, name, category, status
) values (
  '20000000-0000-4000-8000-000000000020',
  '00000000-0000-4000-8000-000000000020',
  '00000000-0000-4000-8000-000000000020/original.jpg',
  '00000000-0000-4000-8000-000000000020/clean.png',
  'delete-fixture-hash', 'Delete fixture', 'top', 'ready'
);
insert into public.tryon_jobs (
  id, user_id, body_photo_id, garment_id, cache_key, status, result_path
) values (
  '30000000-0000-4000-8000-000000000020',
  '00000000-0000-4000-8000-000000000020',
  '10000000-0000-4000-8000-000000000020',
  '20000000-0000-4000-8000-000000000020',
  'delete-fixture-cache', 'done',
  '00000000-0000-4000-8000-000000000020/result.png'
);
insert into public.marketplace_listings (
  id, garment_id, seller_id, accepts_credits, accepts_swap, is_giveaway,
  credit_price, pickup_area
) values (
  '40000000-0000-4000-8000-000000000020',
  '20000000-0000-4000-8000-000000000020',
  '00000000-0000-4000-8000-000000000020',
  false, false, true, null, 'Delete fixture area'
);
insert into public.marketplace_offers (
  id, listing_id, buyer_id, seller_id, mode, status
) values (
  '50000000-0000-4000-8000-000000000020',
  '40000000-0000-4000-8000-000000000020',
  '00000000-0000-4000-8000-000000000022',
  '00000000-0000-4000-8000-000000000020',
  'giveaway', 'rejected'
);
insert into public.marketplace_messages (offer_id, sender_id, body)
values (
  '50000000-0000-4000-8000-000000000020',
  '00000000-0000-4000-8000-000000000020',
  'Personal message removed during deletion'
);
insert into public.marketplace_credit_accounts (user_id, available_balance)
values ('00000000-0000-4000-8000-000000000020', 10);
insert into public.marketplace_credit_ledger (
  user_id, kind, delta_available, idempotency_key, description
) values (
  '00000000-0000-4000-8000-000000000020',
  'adjustment', 10, 'deletion-retained-ledger', 'Retained accounting fixture'
);

insert into public.marketplace_credit_accounts (user_id, reserved_balance)
values ('00000000-0000-4000-8000-000000000021', 5);

create temporary table deletion_request_fixture as
select * from public.account_deletion_start(
  '00000000-0000-4000-8000-000000000020'
);

select is(
  (select status from deletion_request_fixture),
  'purging',
  'starting deletion creates an active tombstone'
);
select is(
  (select request_id from public.account_deletion_start(
    '00000000-0000-4000-8000-000000000020'
  )),
  (select request_id from deletion_request_fixture),
  'starting deletion is idempotent'
);
select throws_ok(
  $$select * from public.account_deletion_start(
    '00000000-0000-4000-8000-000000000021'
  )$$,
  'P0001',
  'Account deletion blocked by unresolved marketplace activity',
  'reserved credits block deletion before a tombstone is created'
);
select is(
  (select count(*) from private.account_deletion_requests
   where auth_user_id = '00000000-0000-4000-8000-000000000021'),
  0::bigint,
  'a blocked deletion does not strand a tombstone'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000020', true);
select throws_ok(
  $$insert into public.garments (user_id, original_path, status)
    values (
      '00000000-0000-4000-8000-000000000020',
      '00000000-0000-4000-8000-000000000020/late.jpg',
      'processing'
    )$$,
  'P0001',
  'Account deletion in progress',
  'the tombstone blocks late personal-data writes'
);
select is(
  public.account_deletion_write_allowed(),
  false,
  'the storage-policy helper denies the deleting member'
);
reset role;

select public.account_deletion_mark_storage_step(
  (select request_id from deletion_request_fixture), 'body'
);
select public.account_deletion_mark_storage_step(
  (select request_id from deletion_request_fixture), 'garments'
);
select public.account_deletion_mark_storage_step(
  (select request_id from deletion_request_fixture), 'results'
);
select is(
  (select count(*) from private.account_deletion_checkpoints
   where request_id = (select request_id from deletion_request_fixture)
     and status = 'completed'),
  4::bigint,
  'the tombstone and three storage buckets have durable completed checkpoints'
);

select public.account_deletion_purge_database(
  (select request_id from deletion_request_fixture)
);
select results_eq(
  $$select
      (select count(*) from public.body_photos where user_id = '00000000-0000-4000-8000-000000000020'),
      (select count(*) from public.garments where user_id = '00000000-0000-4000-8000-000000000020'),
      (select count(*) from public.tryon_jobs where user_id = '00000000-0000-4000-8000-000000000020'),
      (select count(*) from public.marketplace_messages where sender_id = '00000000-0000-4000-8000-000000000020')$$,
  $$values (0::bigint, 0::bigint, 0::bigint, 0::bigint)$$,
  'database purge removes private media metadata, jobs, garments, and authored messages'
);
select results_eq(
  $$select garment_id, seller_id, pickup_area, status, deleted_at is not null
    from public.marketplace_listings
    where id = '40000000-0000-4000-8000-000000000020'$$,
  $$values (null::uuid, null::uuid, 'Deleted account'::text, 'withdrawn'::text, true)$$,
  'database purge anonymizes the retained listing shell'
);
select is(
  (select count(*) from public.marketplace_credit_ledger
   where idempotency_key = 'deletion-retained-ledger'),
  1::bigint,
  'immutable accounting history is retained'
);
select is(
  (select status from private.account_deletion_requests
   where id = (select request_id from deletion_request_fixture)),
  'awaiting_auth_delete',
  'database purge advances to the auth-deletion checkpoint'
);

delete from auth.users where id = '00000000-0000-4000-8000-000000000020';

select results_eq(
  $$select status, auth_user_id, completed_at is not null
    from private.account_deletion_requests
    where id = (select request_id from deletion_request_fixture)$$,
  $$values ('completed'::text, null::uuid, true)$$,
  'auth deletion atomically completes the tombstone and removes the live identifier'
);
select results_eq(
  $$select party.user_id, ledger.user_id
    from public.marketplace_credit_ledger ledger
    join private.marketplace_parties party on party.id = ledger.party_id
    where ledger.idempotency_key = 'deletion-retained-ledger'$$,
  $$values (null::uuid, null::uuid)$$,
  'retained history is detached from profile and Auth identity'
);
select is(
  (select count(*) from public.profiles
   where id = '00000000-0000-4000-8000-000000000020'),
  0::bigint,
  'the public profile is no longer discoverable'
);
select is(
  (select count(*) from public.marketplace_reconcile_credit_ledger() where not balanced),
  0::bigint,
  'retained accounting still reconciles after identity deletion'
);
select is(
  (select count(*) from private.account_deletion_checkpoints
   where request_id = (select request_id from deletion_request_fixture)
     and step = 'auth_delete' and status = 'completed'),
  1::bigint,
  'the auth trigger records its durable completion checkpoint'
);

select * from finish();
rollback;
