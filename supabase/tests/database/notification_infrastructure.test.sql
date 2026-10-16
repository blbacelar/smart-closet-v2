begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

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
select is(
  (select public.register_push_token(
    'ExpoPushToken[token-one]',
    '10000000-0000-4000-8000-000000000091',
    'ios'
  )),
  (select id from private.notification_push_tokens where expo_token = 'ExpoPushToken[token-one]'),
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
  (select user_id from private.notification_push_tokens where expo_token = 'ExpoPushToken[token-one]'),
  '00000000-0000-4000-8000-000000000092'::uuid,
  'duplicate token ownership moves to the latest authenticated account'
);
select is(
  (select count(*) from private.notification_push_tokens where status = 'active'),
  1::bigint,
  'only one active token remains for a physical installation'
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
select is((select count(*) from public.notification_prepare_deliveries((select id from claimed_notifications))), 1::bigint, 'preparation retries do not duplicate delivery rows');
reset role;

update private.notification_outbox set lease_until = now() - interval '1 second';
set local role service_role;
select is((select count(*) from public.notification_claim_outbox('worker-two', 10, interval '1 minute')), 1::bigint, 'an abandoned lease is recovered');
reset role;

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

select * from finish();
rollback;
