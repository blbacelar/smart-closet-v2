begin;

create extension if not exists pgtap with schema extensions;

select plan(31);

select has_table('private', 'operational_health_snapshots', 'health snapshots are private');
select has_table('private', 'operational_health_config', 'health thresholds have one private source');
select is(
  has_table_privilege('authenticated', 'private.operational_health_snapshots', 'select'),
  false,
  'members cannot read operational snapshots'
);
select is(
  has_table_privilege('service_role', 'private.operational_health_snapshots', 'select'),
  false,
  'the health endpoint cannot bypass the aggregate RPC to read snapshots'
);
select is(
  has_table_privilege('service_role', 'private.operational_health_config', 'select'),
  false,
  'the service role cannot read the private threshold table directly'
);
select is(
  has_function_privilege(
    'service_role',
    'public.operational_health_check(timestamp with time zone,interval,integer,integer)',
    'execute'
  ),
  true,
  'the service role can execute the aggregate health check'
);
select is(
  has_function_privilege(
    'service_role',
    'public.configure_operational_health(interval,integer,integer)',
    'execute'
  ),
  true,
  'the service role can synchronize deployment thresholds'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.configure_operational_health(interval,integer,integer)',
    'execute'
  ),
  false,
  'members cannot change operational thresholds'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.operational_health_check(timestamp with time zone,interval,integer,integer)',
    'execute'
  ),
  false,
  'members cannot execute the operational health check'
);
select is(
  has_function_privilege(
    'anon',
    'public.operational_health_check(timestamp with time zone,interval,integer,integer)',
    'execute'
  ),
  false,
  'anonymous callers cannot execute the operational health check'
);
select is(
  has_function_privilege(
    'authenticated',
    'private.capture_operational_health(timestamp with time zone,interval,integer,integer)',
    'execute'
  ),
  false,
  'members cannot capture operational snapshots'
);
select is(
  (select count(*) from cron.job where jobname = 'fitly-operational-health'),
  1::bigint,
  'one operational-health schedule is installed'
);
select is(
  (select schedule from cron.job where jobname = 'fitly-operational-health'),
  '*/5 * * * *'::text,
  'the aggregate snapshot is captured every five minutes'
);

select is(
  (select count(*) from public.operational_health_check(
    '2026-10-16 12:00:00+00', interval '15 minutes', 1, 10
  )),
  7::bigint,
  'the health check returns the complete bounded metric set'
);
select results_eq(
  $$select metric from public.operational_health_check(
      '2026-10-16 12:00:00+00', interval '15 minutes', 1, 10
    ) order by metric$$,
  $$values
      ('acquisition_anomalies'::text),
      ('credit_ledger_imbalance'::text),
      ('expiry_retry_backlog'::text),
      ('overdue_marketplace_items'::text),
      ('recent_notification_failures'::text),
      ('stale_notification_work'::text),
      ('stale_tryon_jobs'::text)$$,
  'only allowlisted aggregate metric names are returned'
);
select is(
  (select count(*) from public.operational_health_check(
    '2026-10-16 12:00:00+00', interval '15 minutes', 1, 10
  ) where status = 'ok'),
  7::bigint,
  'a clean database reports every metric healthy'
);
set local role service_role;
select lives_ok(
  $$select public.configure_operational_health(interval '20 minutes', 2, 8)$$,
  'the function deployment can synchronize bounded thresholds'
);
reset role;
select results_eq(
  $$select warning_threshold, critical_threshold
    from public.operational_health_check('2026-10-16 12:00:00+00')
    where metric = 'expiry_retry_backlog'$$,
  $$values (2::bigint, 8::bigint)$$,
  'the endpoint and scheduled checks read the same authoritative thresholds'
);
select ok(
  pg_get_function_result(
    'public.operational_health_check(timestamp with time zone,interval,integer,integer)'::regprocedure
  ) !~* '(user|email|uuid|resource|listing|offer|transaction)_?id',
  'the RPC result shape cannot expose row or member identities'
);

select throws_ok(
  $$select * from public.operational_health_check(
    '2026-10-16 12:00:00+00', interval '0 minutes', 1, 10
  )$$,
  '22023', null,
  'the stale-work window has a safe lower bound'
);
select throws_ok(
  $$select * from public.operational_health_check(
    '2026-10-16 12:00:00+00', interval '15 minutes', 0, 10
  )$$,
  '22023', null,
  'the warning threshold must be positive'
);
select throws_ok(
  $$select * from public.operational_health_check(
    '2026-10-16 12:00:00+00', interval '15 minutes', 10, 10
  )$$,
  '22023', null,
  'the critical threshold must exceed the warning threshold'
);

insert into private.marketplace_expiry_failures (
  resource_type, resource_id, attempt_count, last_sqlstate, next_retry_at
) values (
  'offer', '10000000-0000-4000-8000-000000000123', 1, '40001',
  '2026-10-16 11:59:00+00'
);

select results_eq(
  $$select status, current_count from public.operational_health_check(
      '2026-10-16 12:00:00+00', interval '15 minutes', 1, 2
    ) where metric = 'expiry_retry_backlog'$$,
  $$values ('warning'::text, 1::bigint)$$,
  'synthetic retry backlog raises a warning without exposing the failed row'
);

insert into auth.users (id, email) values (
  '00000000-0000-4000-8000-000000000124', 'health-notification@example.com'
);
insert into private.notification_push_tokens (
  id, user_id, installation_id, expo_token, platform
) values (
  '20000000-0000-4000-8000-000000000124',
  '00000000-0000-4000-8000-000000000124',
  '30000000-0000-4000-8000-000000000124',
  'ExpoPushToken[health-notification]', 'ios'
);
insert into private.notification_outbox (
  id, event_key, recipient_user_id, kind, status, available_at, created_at, updated_at
) values (
  '40000000-0000-4000-8000-000000000124', 'health-notification-event',
  '00000000-0000-4000-8000-000000000124', 'account_update', 'pending',
  '2026-10-16 11:00:00+00', '2026-10-16 11:00:00+00', '2026-10-16 11:00:00+00'
);
select results_eq(
  $$select status, current_count from public.operational_health_check(
      '2026-10-16 12:00:00+00', interval '15 minutes', 1, 10
    ) where metric = 'stale_notification_work'$$,
  $$values ('warning'::text, 1::bigint)$$,
  'available pending work becomes stale when the dispatcher stops before claim'
);

delete from private.notification_outbox
where id = '40000000-0000-4000-8000-000000000124';
insert into private.notification_outbox (
  id, event_key, recipient_user_id, kind, status, available_at, created_at, updated_at
) values (
  '40000000-0000-4000-8000-000000000124', 'health-notification-event',
  '00000000-0000-4000-8000-000000000124', 'account_update', 'awaiting_receipts',
  '2026-10-16 11:00:00+00', '2026-10-16 11:00:00+00', '2026-10-16 11:00:00+00'
);
insert into private.notification_deliveries (
  outbox_id, token_id, status, provider_ticket_id, receipt_available_at,
  created_at, updated_at
) values (
  '40000000-0000-4000-8000-000000000124',
  '20000000-0000-4000-8000-000000000124', 'ticketed', 'health-ticket',
  '2026-10-16 11:00:00+00', '2026-10-16 11:00:00+00', '2026-10-16 11:00:00+00'
);
select results_eq(
  $$select status, current_count from public.operational_health_check(
      '2026-10-16 12:00:00+00', interval '15 minutes', 1, 10
    ) where metric = 'stale_notification_work'$$,
  $$values ('warning'::text, 2::bigint)$$,
  'stale receipt outbox and due ticket are both visible when the receipt worker stops'
);

insert into private.operational_health_snapshots (
  checked_at, overall_status, metrics
) values (
  '2026-09-01 00:00:00+00', 'ok', '[]'::jsonb
);
set local role service_role;
select public.configure_operational_health(interval '15 minutes', 1, 10);
reset role;
select lives_ok(
  $$select private.capture_operational_health(
    '2026-10-16 12:00:00+00'
  )$$,
  'the scheduler can capture a synthetic warning snapshot'
);
select is(
  (select count(*) from private.operational_health_snapshots
   where checked_at < '2026-09-16 12:00:00+00'),
  0::bigint,
  'snapshot capture purges data beyond the thirty-day retention window'
);
select is(
  (select count(*) from private.operational_health_snapshots
   where checked_at = '2026-10-16 12:00:00+00'),
  1::bigint,
  'capture records exactly one aggregate snapshot for the requested instant'
);
select ok(
  not exists (
    select 1 from private.operational_health_snapshots
    where position('@' in metrics::text) > 0
  ),
  'captured metrics contain no email-like content'
);
select ok(
  not exists (
    select 1 from private.operational_health_snapshots
    where metrics::text
      ~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
  ),
  'captured metrics contain no UUIDs'
);
select is(
  (select overall_status from private.operational_health_snapshots
   where checked_at = '2026-10-16 12:00:00+00'),
  'warning'::text,
  'the aggregate snapshot records the synthetic incident severity'
);

select * from finish();
rollback;
