-- Consent-gated, first-party product analytics for the activation, fitting, and
-- paywall funnels. Events intentionally exclude media, messages, URLs, names,
-- email addresses, and precise location. Rows expire after 90 days.
--
-- Rollback: create a forward migration that unschedules fitly-analytics-retention
-- and drops the retention function, policy, indexes, and table.

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_name text not null check (event_name in (
    'app_opened',
    'auth_signed_in',
    'auth_signed_up',
    'onboarding_completed',
    'body_photo_uploaded',
    'garment_uploaded',
    'tryon_requested',
    'tryon_completed',
    'paywall_viewed',
    'subscription_purchase_started',
    'account_deleted',
    'app_error'
  )),
  properties jsonb not null default '{}'::jsonb
    check (jsonb_typeof(properties) = 'object')
    check (pg_column_size(properties) <= 4096),
  occurred_at timestamptz not null default now()
);

create index if not exists analytics_events_funnel_idx
  on public.analytics_events (event_name, occurred_at desc);
create index if not exists analytics_events_retention_idx
  on public.analytics_events (occurred_at);

alter table public.analytics_events enable row level security;

drop policy if exists "members_insert_own_analytics_events" on public.analytics_events;
create policy "members_insert_own_analytics_events"
on public.analytics_events
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
  )
);

revoke all on table public.analytics_events from public, anon, authenticated;
grant insert(user_id, event_name, properties) on table public.analytics_events to authenticated;
grant select, delete on table public.analytics_events to service_role;

create or replace function private.purge_expired_analytics_events()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count bigint;
begin
  delete from public.analytics_events
  where occurred_at < now() - interval '90 days';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function private.purge_expired_analytics_events() from public, anon, authenticated;

create or replace function public.get_analytics_funnel(
  p_from timestamptz default now() - interval '30 days',
  p_to timestamptz default now()
)
returns table (
  event_name text,
  event_count bigint,
  unique_members bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_from is null or p_to is null or p_from >= p_to or p_to - p_from > interval '366 days' then
    raise check_violation using message = 'Analytics range must be between 1 second and 366 days';
  end if;

  return query
  select
    events.event_name,
    count(*) as event_count,
    count(distinct events.user_id) as unique_members
  from public.analytics_events as events
  where events.occurred_at >= p_from
    and events.occurred_at < p_to
  group by events.event_name
  order by events.event_name;
end;
$$;

revoke all on function public.get_analytics_funnel(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.get_analytics_funnel(timestamptz, timestamptz) to service_role;

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'fitly-analytics-retention';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'fitly-analytics-retention',
    '23 3 * * *',
    $job$select private.purge_expired_analytics_events()$job$
  );
end;
$$;
