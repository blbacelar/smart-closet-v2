-- Rollback plan (as a new forward migration after deployment): unschedule
-- fitly-reconcile-stuck-tryon-jobs, drop reconcile_stuck_tryon_jobs(interval),
-- and remove tryon_jobs from supabase_realtime only if no other client uses it.

create extension if not exists pg_cron with schema pg_catalog;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tryon_jobs'
  ) then
    alter publication supabase_realtime add table public.tryon_jobs;
  end if;
end;
$$;

create or replace function public.reconcile_stuck_tryon_jobs(
  p_stale_after interval default interval '10 minutes'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_record record;
  recovered_count integer := 0;
begin
  if p_stale_after is null
    or p_stale_after < interval '1 minute'
    or p_stale_after > interval '24 hours' then
    raise check_violation using message = 'Invalid stale try-on interval';
  end if;

  for job_record in
    select id, user_id
    from public.tryon_jobs
    where status in ('queued', 'running')
      and coalesce(started_at, created_at) < now() - p_stale_after
    order by created_at
    limit 100
    for update skip locked
  loop
    perform public.fail_tryon_job(
      job_record.id,
      job_record.user_id,
      'timeout',
      'reconciler',
      0
    );
    recovered_count := recovered_count + 1;
  end loop;

  return recovered_count;
end;
$$;

revoke all on function public.reconcile_stuck_tryon_jobs(interval)
  from public, anon, authenticated;
grant execute on function public.reconcile_stuck_tryon_jobs(interval)
  to service_role;

select cron.schedule(
  'fitly-reconcile-stuck-tryon-jobs',
  '*/5 * * * *',
  $$select public.reconcile_stuck_tryon_jobs(interval '10 minutes');$$
);
