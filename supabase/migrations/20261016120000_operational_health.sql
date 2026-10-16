-- C23: aggregate, provider-neutral health checks. Snapshots intentionally
-- contain counts and thresholds only, never member or resource identifiers.

create table private.operational_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  checked_at timestamptz not null default now(),
  overall_status text not null check (overall_status in ('ok', 'warning', 'critical')),
  metrics jsonb not null check (jsonb_typeof(metrics) = 'array'),
  created_at timestamptz not null default now()
);

create index operational_health_snapshots_checked_idx
  on private.operational_health_snapshots(checked_at desc);

revoke all on private.operational_health_snapshots from public, anon, authenticated;

create table private.operational_health_config (
  id boolean primary key default true check (id),
  stale_after interval not null default interval '15 minutes'
    check (stale_after between interval '1 minute' and interval '24 hours'),
  warning_count integer not null default 1 check (warning_count >= 1),
  critical_count integer not null default 10 check (critical_count > warning_count),
  updated_at timestamptz not null default now()
);

insert into private.operational_health_config (id) values (true);
revoke all on private.operational_health_config from public, anon, authenticated, service_role;

create index notification_outbox_health_idx
  on private.notification_outbox(status, available_at, lease_until, updated_at)
  where status in ('pending', 'processing', 'awaiting_receipts');
create index notification_delivery_health_idx
  on private.notification_deliveries(
    status, receipt_available_at, receipt_lease_until, updated_at
  ) where status in ('sending', 'ticketed');

create or replace function public.configure_operational_health(
  p_stale_after interval,
  p_warning_count integer,
  p_critical_count integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_stale_after is null
     or p_stale_after < interval '1 minute'
     or p_stale_after > interval '24 hours'
     or p_warning_count < 1
     or p_critical_count <= p_warning_count then
    raise exception 'Invalid operational health thresholds' using errcode = '22023';
  end if;
  update private.operational_health_config
  set stale_after = p_stale_after,
      warning_count = p_warning_count,
      critical_count = p_critical_count,
      updated_at = now()
  where id;
end;
$$;

create or replace function public.operational_health_check(
  p_now timestamptz default now(),
  p_stale_after interval default null,
  p_warning_count integer default null,
  p_critical_count integer default null
)
returns table (
  metric text,
  status text,
  current_count bigint,
  warning_threshold bigint,
  critical_threshold bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_stale_after interval;
  v_warning_count integer;
  v_critical_count integer;
begin
  select
    coalesce(p_stale_after, config.stale_after),
    coalesce(p_warning_count, config.warning_count),
    coalesce(p_critical_count, config.critical_count)
  into v_stale_after, v_warning_count, v_critical_count
  from private.operational_health_config config
  where config.id;

  if p_now is null
     or v_stale_after is null
     or v_stale_after < interval '1 minute'
     or v_stale_after > interval '24 hours'
     or v_warning_count < 1
     or v_critical_count <= v_warning_count then
    raise exception 'Invalid operational health thresholds' using errcode = '22023';
  end if;

  return query
  with counts as (
    select 'credit_ledger_imbalance'::text as metric,
      (select count(*) from public.marketplace_reconcile_credit_ledger() where not balanced)::bigint as current_count,
      1::bigint as warning_threshold,
      1::bigint as critical_threshold
    union all
    select 'acquisition_anomalies',
      (select count(*) from public.marketplace_acquisition_reconciliation())::bigint,
      1::bigint,
      1::bigint
    union all
    select 'overdue_marketplace_items',
      (
        (select count(*) from public.marketplace_offers offers
         where offers.status = 'pending' and offers.expires_at <= p_now)
        +
        (select count(*) from public.marketplace_transactions transactions
         where transactions.status = 'awaiting_handoff'
           and transactions.handoff_deadline <= p_now)
      )::bigint,
      v_warning_count::bigint,
      v_critical_count::bigint
    union all
    select 'expiry_retry_backlog',
      (select count(*) from private.marketplace_expiry_failures where next_retry_at <= p_now)::bigint,
      v_warning_count::bigint,
      v_critical_count::bigint
    union all
    select 'stale_tryon_jobs',
      (select count(*) from public.tryon_jobs jobs
       where jobs.status in ('queued', 'running')
         and coalesce(jobs.started_at, jobs.created_at) <= p_now - v_stale_after)::bigint,
      v_warning_count::bigint,
      v_critical_count::bigint
    union all
    select 'stale_notification_work',
      (
        (select count(*) from private.notification_outbox outbox
         where (outbox.status = 'processing' and outbox.lease_until <= p_now)
            or (outbox.status = 'pending' and (
              outbox.attempts >= 5
              or outbox.available_at <= p_now - v_stale_after
            ))
            or (outbox.status = 'awaiting_receipts'
                and outbox.updated_at <= p_now - v_stale_after))
        +
        (select count(*) from private.notification_deliveries deliveries
         where (deliveries.status = 'sending'
                and deliveries.updated_at <= p_now - v_stale_after)
            or (deliveries.status = 'ticketed' and (
              deliveries.receipt_lease_until <= p_now
              or deliveries.receipt_available_at <= p_now - v_stale_after
            )))
      )::bigint,
      v_warning_count::bigint,
      v_critical_count::bigint
    union all
    select 'recent_notification_failures',
      (
        (select count(*) from private.notification_outbox outbox
         where outbox.status = 'dead'
           and outbox.updated_at >= p_now - interval '1 hour')
        +
        (select count(*) from private.notification_deliveries deliveries
         where deliveries.status = 'dead'
           and deliveries.updated_at >= p_now - interval '1 hour')
      )::bigint,
      v_warning_count::bigint,
      v_critical_count::bigint
  )
  select
    counts.metric,
    case
      when counts.current_count >= counts.critical_threshold then 'critical'
      when counts.current_count >= counts.warning_threshold then 'warning'
      else 'ok'
    end,
    counts.current_count,
    counts.warning_threshold,
    counts.critical_threshold
  from counts
  order by counts.metric;
end;
$$;

create or replace function private.capture_operational_health(
  p_now timestamptz default now(),
  p_stale_after interval default null,
  p_warning_count integer default null,
  p_critical_count integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_metrics jsonb;
  v_status text;
begin
  select
    jsonb_agg(to_jsonb(result) order by result.metric),
    case
      when bool_or(result.status = 'critical') then 'critical'
      when bool_or(result.status = 'warning') then 'warning'
      else 'ok'
    end
  into v_metrics, v_status
  from public.operational_health_check(
    p_now, p_stale_after, p_warning_count, p_critical_count
  ) result;

  insert into private.operational_health_snapshots (checked_at, overall_status, metrics)
  values (p_now, v_status, coalesce(v_metrics, '[]'::jsonb))
  returning id into v_id;

  delete from private.operational_health_snapshots
  where checked_at < p_now - interval '30 days';
  return v_id;
end;
$$;

revoke all on function public.operational_health_check(timestamptz, interval, integer, integer)
  from public, anon, authenticated;
grant execute on function public.operational_health_check(timestamptz, interval, integer, integer)
  to service_role;
revoke all on function public.configure_operational_health(interval, integer, integer)
  from public, anon, authenticated;
grant execute on function public.configure_operational_health(interval, integer, integer)
  to service_role;
revoke all on function private.capture_operational_health(timestamptz, interval, integer, integer)
  from public, anon, authenticated;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'fitly-operational-health';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule(
    'fitly-operational-health',
    '*/5 * * * *',
    $job$select private.capture_operational_health()$job$
  );
end;
$$;

comment on function public.operational_health_check(timestamptz, interval, integer, integer) is
  'Service-only aggregate health metrics. Never returns row or member identifiers.';
