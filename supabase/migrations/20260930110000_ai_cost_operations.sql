-- Operator-only AI spend reporting and durable threshold alerts. Dashboard rows
-- aggregate across members and never expose user IDs or private asset details.
-- Rollback: create a forward migration that unschedules fitly-ai-cost-alerts and
-- drops these functions/table after exporting any incident records.

create table if not exists public.ai_cost_alerts (
  id bigint generated always as identity primary key,
  day date not null,
  level text not null check (level in ('warning', 'critical')),
  total_cost_usd numeric(12,4) not null check (total_cost_usd >= 0),
  threshold_usd numeric(12,4) not null check (threshold_usd > 0),
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  unique (day, level)
);

alter table public.ai_cost_alerts enable row level security;
revoke all on table public.ai_cost_alerts from public, anon, authenticated;
grant select, update on table public.ai_cost_alerts to service_role;

create or replace function public.get_ai_cost_dashboard(p_days integer default 30)
returns table (
  day date,
  kind text,
  provider text,
  request_count bigint,
  cost_usd numeric
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_days is null or not (p_days between 1 and 365) then
    raise check_violation using message = 'Dashboard range must be between 1 and 365 days';
  end if;

  return query
  select
    ledger.created_at::date as day,
    ledger.kind,
    ledger.provider,
    count(*) as request_count,
    sum(ledger.cost_usd) as cost_usd
  from public.ai_cost_ledger as ledger
  where ledger.created_at >= current_date - (p_days - 1)
  group by ledger.created_at::date, ledger.kind, ledger.provider
  order by ledger.created_at::date desc, ledger.kind, ledger.provider;
end;
$$;

revoke all on function public.get_ai_cost_dashboard(integer) from public, anon, authenticated;
grant execute on function public.get_ai_cost_dashboard(integer) to service_role;

create or replace function private.evaluate_ai_cost_alerts(
  p_day date,
  p_warning_usd numeric,
  p_critical_usd numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  daily_total numeric(12,4);
begin
  if p_day is null
    or p_warning_usd <= 0
    or p_critical_usd <= p_warning_usd then
    raise check_violation using message = 'Invalid AI cost alert thresholds';
  end if;

  select coalesce(sum(cost_usd), 0)
  into daily_total
  from public.ai_cost_ledger
  where created_at >= p_day
    and created_at < p_day + 1;

  if daily_total >= p_warning_usd then
    insert into public.ai_cost_alerts (day, level, total_cost_usd, threshold_usd)
    values (p_day, 'warning', daily_total, p_warning_usd)
    on conflict (day, level) do update
      set total_cost_usd = excluded.total_cost_usd;
  end if;

  if daily_total >= p_critical_usd then
    insert into public.ai_cost_alerts (day, level, total_cost_usd, threshold_usd)
    values (p_day, 'critical', daily_total, p_critical_usd)
    on conflict (day, level) do update
      set total_cost_usd = excluded.total_cost_usd;
  end if;
end;
$$;

revoke all on function private.evaluate_ai_cost_alerts(date, numeric, numeric) from public, anon, authenticated;

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'fitly-ai-cost-alerts';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'fitly-ai-cost-alerts',
    '15 * * * *',
    $job$select private.evaluate_ai_cost_alerts(current_date, 10, 25)$job$
  );
end;
$$;
