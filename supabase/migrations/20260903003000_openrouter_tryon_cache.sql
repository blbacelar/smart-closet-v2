create or replace function public.reserve_tryon_job(
  p_user_id uuid,
  p_body_photo_id uuid,
  p_garment_id uuid,
  p_cache_namespace text
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
  if p_cache_namespace is null
    or length(btrim(p_cache_namespace)) = 0
    or length(p_cache_namespace) > 200 then
    raise check_violation using message = 'Invalid try-on cache namespace';
  end if;

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
        p_body_photo_id::text || ':' || garment_record.image_hash || ':' || p_cache_namespace,
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

revoke all on function public.reserve_tryon_job(uuid, uuid, uuid) from service_role;
revoke all on function public.reserve_tryon_job(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.reserve_tryon_job(uuid, uuid, uuid, text) to service_role;
