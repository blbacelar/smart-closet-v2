alter table public.tryon_jobs
  add column failure_code text,
  add column started_at timestamptz,
  add column completed_at timestamptz,
  add column quota_refunded_at timestamptz;

alter table public.tryon_jobs
  add constraint tryon_jobs_failure_code_check
  check (failure_code is null or failure_code in ('generation_failed', 'timeout'));

alter table public.tryon_jobs
  add constraint tryon_jobs_result_path_owned
  check (result_path is null or split_part(result_path, '/', 1) = user_id::text)
  not valid;

alter table public.tryon_jobs
  validate constraint tryon_jobs_result_path_owned;

create unique index tryon_jobs_result_path_key
  on public.tryon_jobs(result_path)
  where result_path is not null;

create unique index tryon_jobs_active_cache_key_key
  on public.tryon_jobs(user_id, cache_key)
  where status in ('queued', 'running', 'done');

drop policy if exists "tryon_jobs_feedback_own" on public.tryon_jobs;

create policy "tryon_jobs_feedback_own"
on public.tryon_jobs
for update
to authenticated
using ((select auth.uid()) = user_id and status = 'done')
with check ((select auth.uid()) = user_id and status = 'done');

revoke update on public.tryon_jobs from authenticated;
grant update(feedback) on public.tryon_jobs to authenticated;

create or replace function public.get_my_tryon_quota()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_tier text;
  daily_limit integer;
  used_count integer;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  select tier into current_tier
  from public.profiles
  where id = current_user_id;

  if not found then
    raise no_data_found using message = 'Profile not found';
  end if;

  daily_limit := case when current_tier = 'pro' then 60 else 3 end;
  select coalesce(tryon_count, 0) into used_count
  from public.usage_daily
  where user_id = current_user_id and day = current_date;

  used_count := coalesce(used_count, 0);
  return jsonb_build_object(
    'tier', current_tier,
    'limit', daily_limit,
    'used', used_count,
    'remaining', greatest(0, daily_limit - used_count)
  );
end;
$$;

create or replace function public.reserve_tryon_job(
  p_user_id uuid,
  p_body_photo_id uuid,
  p_garment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  body_record public.body_photos%rowtype;
  garment_record public.garments%rowtype;
  existing_job public.tryon_jobs%rowtype;
  created_job public.tryon_jobs%rowtype;
  current_tier text;
  daily_limit integer;
  used_count integer;
  cache_value text;
begin
  select * into body_record
  from public.body_photos
  where id = p_body_photo_id and user_id = p_user_id;

  if not found then
    return jsonb_build_object('state', 'not-found');
  end if;
  if body_record.status = 'rejected' then
    return jsonb_build_object('state', 'body-photo-unavailable');
  end if;

  select * into garment_record
  from public.garments
  where id = p_garment_id and user_id = p_user_id;

  if not found then
    return jsonb_build_object('state', 'not-found');
  end if;
  if garment_record.status <> 'ready'
    or garment_record.clean_path is null
    or garment_record.image_hash is null
    or garment_record.category is null then
    return jsonb_build_object('state', 'garment-not-ready');
  end if;

  select tier into current_tier
  from public.profiles
  where id = p_user_id;

  if not found then
    return jsonb_build_object('state', 'not-found');
  end if;
  daily_limit := case when current_tier = 'pro' then 60 else 3 end;

  cache_value := encode(
    extensions.digest(
      convert_to(
        p_body_photo_id::text || ':' || garment_record.image_hash || ':fashn:tryon-v1.6:balanced:42',
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(hashtextextended(cache_value, 0));

  select * into existing_job
  from public.tryon_jobs
  where user_id = p_user_id
    and cache_key = cache_value
    and status in ('queued', 'running', 'done')
  limit 1;

  select coalesce(tryon_count, 0) into used_count
  from public.usage_daily
  where user_id = p_user_id and day = current_date;
  used_count := coalesce(used_count, 0);

  if existing_job.id is not null then
    return jsonb_build_object(
      'state', case when existing_job.status = 'done' then 'cached' else 'in-progress' end,
      'jobId', existing_job.id,
      'status', existing_job.status,
      'limit', daily_limit,
      'remaining', greatest(0, daily_limit - used_count)
    );
  end if;

  insert into public.usage_daily (user_id, day, tryon_count)
  values (p_user_id, current_date, 1)
  on conflict (user_id, day) do update
    set tryon_count = public.usage_daily.tryon_count + 1
    where public.usage_daily.tryon_count < daily_limit
  returning tryon_count into used_count;

  if used_count is null then
    return jsonb_build_object(
      'state', 'quota-exceeded',
      'limit', daily_limit,
      'remaining', 0
    );
  end if;

  insert into public.tryon_jobs (
    user_id,
    body_photo_id,
    garment_id,
    cache_key,
    status
  )
  values (
    p_user_id,
    p_body_photo_id,
    p_garment_id,
    cache_value,
    'queued'
  )
  returning * into created_job;

  return jsonb_build_object(
    'state', 'queued',
    'jobId', created_job.id,
    'status', created_job.status,
    'limit', daily_limit,
    'remaining', greatest(0, daily_limit - used_count)
  );
end;
$$;

create or replace function public.claim_tryon_job(p_job_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_record public.tryon_jobs%rowtype;
  body_path text;
  garment_path text;
  garment_category text;
begin
  select * into job_record
  from public.tryon_jobs
  where id = p_job_id and user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('state', 'not-found');
  end if;
  if job_record.status <> 'queued' then
    return jsonb_build_object('state', job_record.status);
  end if;

  select storage_path into body_path
  from public.body_photos
  where id = job_record.body_photo_id and user_id = p_user_id;

  select clean_path, category into garment_path, garment_category
  from public.garments
  where id = job_record.garment_id and user_id = p_user_id and status = 'ready';

  if body_path is null or garment_path is null or garment_category is null then
    return jsonb_build_object('state', 'failed');
  end if;

  update public.tryon_jobs
  set status = 'running', started_at = now(), failure_code = null
  where id = p_job_id;

  return jsonb_build_object(
    'state', 'claimed',
    'job', jsonb_build_object(
      'id', job_record.id,
      'userId', job_record.user_id,
      'bodyPath', body_path,
      'garmentPath', garment_path,
      'category', garment_category
    )
  );
end;
$$;

create or replace function public.set_tryon_provider_job(
  p_job_id uuid,
  p_user_id uuid,
  p_provider text,
  p_provider_job_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.tryon_jobs
  set provider = left(p_provider, 40), provider_job_id = left(p_provider_job_id, 200)
  where id = p_job_id and user_id = p_user_id and status = 'running';

  if not found then
    raise no_data_found using message = 'Running try-on job not found';
  end if;
end;
$$;

create or replace function public.complete_tryon_job(
  p_job_id uuid,
  p_user_id uuid,
  p_result_path text,
  p_provider text,
  p_cost_usd numeric,
  p_latency_ms integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_cost_usd < 0 or p_latency_ms < 0 then
    raise check_violation using message = 'Invalid try-on accounting';
  end if;

  update public.tryon_jobs
  set status = 'done',
      result_path = p_result_path,
      provider = left(p_provider, 40),
      cost_usd = p_cost_usd,
      latency_ms = p_latency_ms,
      completed_at = now(),
      failure_code = null
  where id = p_job_id and user_id = p_user_id and status = 'running';

  if not found then
    raise no_data_found using message = 'Running try-on job not found';
  end if;

  insert into public.ai_cost_ledger (user_id, kind, provider, cost_usd)
  values (p_user_id, 'tryon', left(p_provider, 40), p_cost_usd);
end;
$$;

create or replace function public.fail_tryon_job(
  p_job_id uuid,
  p_user_id uuid,
  p_failure_code text,
  p_provider text,
  p_cost_usd numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_record public.tryon_jobs%rowtype;
begin
  if p_failure_code not in ('generation_failed', 'timeout') or p_cost_usd < 0 then
    raise check_violation using message = 'Invalid try-on failure accounting';
  end if;

  select * into job_record
  from public.tryon_jobs
  where id = p_job_id and user_id = p_user_id
  for update;

  if not found or job_record.status not in ('queued', 'running') then
    return;
  end if;

  update public.tryon_jobs
  set status = 'failed',
      failure_code = p_failure_code,
      provider = left(p_provider, 40),
      cost_usd = case when p_cost_usd > 0 then p_cost_usd else cost_usd end,
      completed_at = now(),
      quota_refunded_at = coalesce(quota_refunded_at, now())
  where id = p_job_id;

  if job_record.quota_refunded_at is null then
    update public.usage_daily
    set tryon_count = greatest(0, tryon_count - 1)
    where user_id = p_user_id and day = job_record.created_at::date;
  end if;

  if p_cost_usd > 0 then
    insert into public.ai_cost_ledger (user_id, kind, provider, cost_usd)
    values (p_user_id, 'tryon', left(p_provider, 40), p_cost_usd);
  end if;
end;
$$;

revoke all on function public.get_my_tryon_quota() from public, anon;
grant execute on function public.get_my_tryon_quota() to authenticated;

revoke all on function public.reserve_tryon_job(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.claim_tryon_job(uuid, uuid) from public, anon, authenticated;
revoke all on function public.set_tryon_provider_job(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.complete_tryon_job(uuid, uuid, text, text, numeric, integer) from public, anon, authenticated;
revoke all on function public.fail_tryon_job(uuid, uuid, text, text, numeric) from public, anon, authenticated;

grant execute on function public.reserve_tryon_job(uuid, uuid, uuid) to service_role;
grant execute on function public.claim_tryon_job(uuid, uuid) to service_role;
grant execute on function public.set_tryon_provider_job(uuid, uuid, text, text) to service_role;
grant execute on function public.complete_tryon_job(uuid, uuid, text, text, numeric, integer) to service_role;
grant execute on function public.fail_tryon_job(uuid, uuid, text, text, numeric) to service_role;
