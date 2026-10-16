begin;

create extension if not exists pgtap with schema extensions;

select plan(48);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000091', 'push-one@example.com', '{"adult_confirmed":true}'),
  ('00000000-0000-4000-8000-000000000092', 'push-two@example.com', '{"adult_confirmed":true}');

select has_table('private', 'notification_push_tokens', 'push tokens are private');
select has_table('private', 'notification_outbox', 'outbox payloads are private');
select has_table('private', 'notification_deliveries', 'delivery state is private');
select is(has_table_privilege('authenticated', 'private.notification_push_tokens', 'select'), false, 'members cannot read tokens');
select is(has_table_privilege('authenticated', 'private.notification_outbox', 'select'), false, 'members cannot read outbox');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000091', true);
select lives_ok(
  $$select public.register_push_token(
    'ExpoPushToken[token-one]',
    '10000000-0000-4000-8000-000000000091',
    'ios'
  )$$,
  'a member can register the current installation'
);
select lives_ok(
  $$select public.register_push_token(
    'ExpoPushToken[token-one]',
    '10000000-0000-4000-8000-000000000091',
    'ios'
  )$$,
  'registration is idempotent'
);
select throws_ok(
  $$select public.notification_enqueue(
    'client-forgery',
    '00000000-0000-4000-8000-000000000091',
    'account_update',
    null
  )$$,
  '42501', null,
  'a member cannot enqueue a notification'
);
reset role;

create temporary table original_push_token as
select id from private.notification_push_tokens
where expo_token = 'ExpoPushToken[token-one]' and status = 'active';

select is(
  (select count(*) from private.notification_push_tokens where expo_token = 'ExpoPushToken[token-one]'),
  1::bigint,
  'repeated registration keeps one token row'
);

set local role service_role;
create temporary table reassignment_outbox as
select public.notification_enqueue(
  'reassignment-event',
  '00000000-0000-4000-8000-000000000091',
  'account_update',
  '{"kind":"marketplace_inbox"}'::jsonb
) id;
reset role;
insert into private.notification_deliveries (outbox_id, token_id)
select (select id from reassignment_outbox), (select id from original_push_token);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000092', true);
select lives_ok(
  $$select public.register_push_token(
    'ExpoPushToken[token-one]',
    '10000000-0000-4000-8000-000000000092',
    'android'
  )$$,
  'the same physical token is safely reassigned after account switching'
);
reset role;

select is(
  (select user_id from private.notification_push_tokens where expo_token = 'ExpoPushToken[token-one]' and status = 'active'),
  '00000000-0000-4000-8000-000000000092'::uuid,
  'duplicate token ownership moves to the latest authenticated account'
);
select is(
  (select count(*) from private.notification_push_tokens where expo_token = 'ExpoPushToken[token-one]'),
  2::bigint,
  'reassignment preserves an immutable historical token row'
);
select is(
  (select status from private.notification_push_tokens where id = (select id from original_push_token)),
  'disabled',
  'the previous owner token row is disabled rather than mutated'
);
select isnt(
  (select id from private.notification_push_tokens where expo_token = 'ExpoPushToken[token-one]' and status = 'active'),
  (select id from original_push_token),
  'the new owner receives a distinct token identity'
);
select is(
  (select count(*) from private.notification_push_tokens where status = 'active'),
  1::bigint,
  'only one active token remains for a physical installation'
);

set local role service_role;
create temporary table reassignment_claim as
select * from public.notification_claim_outbox('reassignment-worker', 10, interval '1 minute');
select is(
  (select count(*) from public.notification_prepare_deliveries((select id from reassignment_outbox))),
  0::bigint,
  'an old delivery is never prepared for a token now owned by another account'
);
reset role;

update private.notification_deliveries
set status = 'ticketed', provider_ticket_id = 'old-owner-ticket',
    receipt_available_at = now() - interval '1 second'
where outbox_id = (select id from reassignment_outbox);
update private.notification_outbox
set status = 'awaiting_receipts', claimed_by = null, claimed_at = null, lease_until = null
where id = (select id from reassignment_outbox);
set local role service_role;
select * from public.notification_claim_receipts('old-owner-receipt-worker', 10, interval '1 minute');
select public.notification_record_receipts(
  'old-owner-receipt-worker',
  '[{"ticketId":"old-owner-ticket","state":"permanent-failure","code":"DeviceNotRegistered"}]'::jsonb
);
reset role;
select is(
  (select status from private.notification_push_tokens where expo_token = 'ExpoPushToken[token-one]' and user_id = '00000000-0000-4000-8000-000000000092'),
  'active',
  'an old receipt cannot disable the reassigned token owner'
);

set local role service_role;
select public.notification_enqueue(
  'event-one',
  '00000000-0000-4000-8000-000000000092',
  'marketplace_update',
  '{"kind":"marketplace_inbox"}'::jsonb
);
select public.notification_enqueue(
  'event-one',
  '00000000-0000-4000-8000-000000000092',
  'marketplace_update',
  '{"kind":"marketplace_inbox"}'::jsonb
);
reset role;

select is((select count(*) from private.notification_outbox where event_key = 'event-one'), 1::bigint, 'event keys deduplicate');

set local role service_role;
create temporary table claimed_notifications as
select * from public.notification_claim_outbox('worker-one', 10, interval '1 minute');
select is((select count(*) from claimed_notifications), 1::bigint, 'the first worker claims pending work');
select is((select count(*) from public.notification_claim_outbox('worker-two', 10, interval '1 minute')), 0::bigint, 'an active lease prevents a duplicate claim');
select is((select count(*) from public.notification_prepare_deliveries((select id from claimed_notifications))), 1::bigint, 'one delivery is prepared per active token');
select is((select count(*) from public.notification_prepare_deliveries((select id from claimed_notifications))), 0::bigint, 'prepared deliveries are not handed to a second POST attempt');
reset role;

select is(
  (select status from private.notification_deliveries where outbox_id = (select id from claimed_notifications)),
  'sending',
  'a delivery is durably marked sending before the provider POST'
);

update private.notification_outbox set lease_until = now() - interval '1 second';
set local role service_role;
select is((select count(*) from public.notification_claim_outbox('worker-two', 10, interval '1 minute')), 1::bigint, 'an abandoned lease is recovered');
select is(
  (select count(*) from public.notification_prepare_deliveries((select id from claimed_notifications))),
  0::bigint,
  'lease recovery never re-sends a delivery with an ambiguous prior POST'
);
select is(
  (select status from private.notification_deliveries where outbox_id = (select id from claimed_notifications)),
  'dead',
  'an abandoned sending delivery is terminally fenced'
);
select lives_ok(
  $$select public.notification_defer_without_provider(
    (select id from claimed_notifications),
    'worker-two'
  )$$,
  'no-credential mode releases the worker lease safely'
);
reset role;
select results_eq(
  $$select status, attempts from private.notification_outbox where event_key = 'event-one'$$,
  $$values ('pending'::text, 0)$$,
  'no-credential mode does not consume a provider attempt'
);

select lives_ok(
  $$update private.notification_outbox set available_at = now() - interval '1 second', status = 'pending', attempts = 5$$,
  'the retry limit is representable'
);
set local role service_role;
select is((select count(*) from public.notification_claim_outbox('worker-three', 10, interval '1 minute')), 0::bigint, 'poison work beyond the retry limit is not claimed');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000092', true);
select lives_ok(
  $$select public.disable_push_installation('10000000-0000-4000-8000-000000000092', 'logout')$$,
  'logout disables the caller installation'
);
reset role;
select is((select status from private.notification_push_tokens where expo_token = 'ExpoPushToken[token-one]'), 'disabled', 'logout leaves the token inactive');

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000094', 'push-receipt@example.com', '{"adult_confirmed":true}'),
  ('00000000-0000-4000-8000-000000000095', 'push-delete@example.com', '{"adult_confirmed":true}');
insert into private.notification_push_tokens (
  id, user_id, installation_id, expo_token, platform
) values
  ('20000000-0000-4000-8000-000000000094', '00000000-0000-4000-8000-000000000094',
   '10000000-0000-4000-8000-000000000094', 'ExpoPushToken[receipt-token]', 'ios'),
  ('20000000-0000-4000-8000-000000000095', '00000000-0000-4000-8000-000000000095',
   '10000000-0000-4000-8000-000000000095', 'ExpoPushToken[delete-token]', 'android');

set local role service_role;
create temporary table receipt_outbox as
select public.notification_enqueue(
  'receipt-event', '00000000-0000-4000-8000-000000000094', 'account_update', null
) id;
create temporary table receipt_claim as
select * from public.notification_claim_outbox('dispatch-worker', 10, interval '1 minute');
create temporary table receipt_delivery as
select * from public.notification_prepare_deliveries((select id from receipt_outbox));
select lives_ok(
  $$select public.notification_record_tickets(
    (select id from receipt_outbox),
    'dispatch-worker',
    jsonb_build_array(jsonb_build_object(
      'deliveryId', (select delivery_id from receipt_delivery),
      'state', 'ticketed',
      'ticketId', 'expo-ticket-receipt'
    ))
  )$$,
  'a successful provider ticket enters receipt tracking'
);
reset role;
select is((select status from private.notification_outbox where id = (select id from receipt_outbox)), 'awaiting_receipts', 'ticketed outbox waits for receipts');

update private.notification_deliveries
set receipt_available_at = now() - interval '1 second'
where provider_ticket_id = 'expo-ticket-receipt';
set local role service_role;
create temporary table claimed_receipt as
select * from public.notification_claim_receipts('receipt-worker', 10, interval '1 minute');
select is((select count(*) from claimed_receipt), 1::bigint, 'a due receipt is leased once');
select lives_ok(
  $$select public.notification_record_receipts(
    'receipt-worker',
    '[{"ticketId":"expo-ticket-receipt","state":"permanent-failure","code":"DeviceNotRegistered"}]'::jsonb
  )$$,
  'DeviceNotRegistered is recorded as a permanent receipt failure'
);
reset role;
select is((select status from private.notification_push_tokens where id = '20000000-0000-4000-8000-000000000094'), 'disabled', 'an invalid receipt disables its token');
select is((select status from private.notification_deliveries where provider_ticket_id = 'expo-ticket-receipt'), 'dead', 'an invalid receipt is not retried');
select is((select status from private.notification_outbox where id = (select id from receipt_outbox)), 'completed', 'terminal receipts complete the outbox item');

set local role service_role;
create temporary table deletion_outbox as
select public.notification_enqueue(
  'deletion-event', '00000000-0000-4000-8000-000000000095', 'account_update', null
) id;
create temporary table deletion_claim as
select * from public.notification_claim_outbox('delete-worker', 10, interval '1 minute');
create temporary table deletion_delivery as
select * from public.notification_prepare_deliveries((select id from deletion_outbox));
reset role;
select is(
  (select count(*) from deletion_delivery),
  1::bigint,
  'the deletion race starts after a delivery was prepared'
);
create temporary table deletion_request as
select * from public.account_deletion_start('00000000-0000-4000-8000-000000000095');
select is((select count(*) from deletion_request), 1::bigint, 'account deletion starts with notification state present');
select results_eq(
  $$select
      (select status from private.notification_push_tokens where id = '20000000-0000-4000-8000-000000000095'),
      (select status from private.notification_outbox where event_key = 'deletion-event')$$,
  $$values ('disabled'::text, 'dead'::text)$$,
  'account deletion disables tokens and cancels queued delivery immediately'
);

set local role service_role;
select is(
  (
    select count(*)
    from public.notification_authorize_deliveries(
      (select id from deletion_outbox),
      'delete-worker',
      array[(select delivery_id from deletion_delivery)]
    )
  ),
  0::bigint,
  'a deletion crossing prepare and send revokes provider authorization'
);
select public.account_deletion_mark_storage_step((select request_id from deletion_request), 'body');
select public.account_deletion_mark_storage_step((select request_id from deletion_request), 'garments');
select public.account_deletion_mark_storage_step((select request_id from deletion_request), 'results');
select lives_ok(
  format('select public.account_deletion_purge_database(%L)', (select request_id from deletion_request)),
  'notification history does not block database purge'
);
select lives_ok(
  $$delete from auth.users where id = '00000000-0000-4000-8000-000000000095'$$,
  'notification history does not block final Auth deletion'
);
reset role;
select is(
  (select status from private.account_deletion_requests where id = (select request_id from deletion_request)),
  'completed',
  'the deletion lifecycle completes with notification history present'
);
select is(
  (select count(*) from private.notification_push_tokens where user_id = '00000000-0000-4000-8000-000000000095'),
  0::bigint,
  'final account deletion erases private push tokens'
);
select is(
  (select count(*) from private.notification_outbox where recipient_user_id = '00000000-0000-4000-8000-000000000095'),
  0::bigint,
  'final account deletion erases private notification payloads'
);

select * from finish();
rollback;
