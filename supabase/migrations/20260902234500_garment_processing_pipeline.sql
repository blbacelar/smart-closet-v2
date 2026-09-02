begin;

alter table public.garments
  add column processing_attempts integer not null default 0
    check (processing_attempts between 0 and 3),
  add column processing_error text,
  add column processing_started_at timestamptz,
  add column processing_completed_at timestamptz;

alter table public.garments
  add constraint garments_clean_path_owned
  check (clean_path is null or clean_path like user_id::text || '/%') not valid;

alter table public.garments
  validate constraint garments_clean_path_owned;

create unique index garments_clean_path_key
  on public.garments(clean_path)
  where clean_path is not null;

create or replace function public.claim_garment_processing(
  p_garment_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  garment public.garments%rowtype;
begin
  select *
  into garment
  from public.garments
  where id = p_garment_id
    and user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('state', 'not-found');
  end if;

  if garment.status = 'ready' then
    return jsonb_build_object('state', 'ready');
  end if;

  if garment.processing_attempts >= 3 then
    return jsonb_build_object('state', 'exhausted');
  end if;

  if garment.status = 'processing'
    and garment.processing_started_at is not null
    and garment.processing_started_at >= now() - interval '2 minutes' then
    return jsonb_build_object('state', 'busy');
  end if;

  update public.garments
  set status = 'processing',
      processing_attempts = processing_attempts + 1,
      processing_error = null,
      processing_started_at = now(),
      processing_completed_at = null
  where id = garment.id
  returning * into garment;

  return jsonb_build_object(
    'state', 'claimed',
    'garment', jsonb_build_object(
      'id', garment.id,
      'userId', garment.user_id,
      'originalPath', garment.original_path,
      'attempt', garment.processing_attempts
    )
  );
end;
$$;

create or replace function public.complete_garment_processing(
  p_garment_id uuid,
  p_user_id uuid,
  p_clean_path text,
  p_image_hash text,
  p_provider text,
  p_cost_usd numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_clean_path not like p_user_id::text || '/%'
    or length(p_image_hash) < 16
    or length(btrim(p_provider)) = 0
    or p_cost_usd < 0 then
    raise exception 'Invalid garment processing result.' using errcode = '22023';
  end if;

  update public.garments
  set clean_path = p_clean_path,
      image_hash = p_image_hash,
      status = 'ready',
      processing_error = null,
      processing_completed_at = now()
  where id = p_garment_id
    and user_id = p_user_id
    and status = 'processing';

  if not found then
    raise exception 'Garment is not processing.' using errcode = '55000';
  end if;

  insert into public.ai_cost_ledger (user_id, kind, provider, cost_usd)
  values (p_user_id, 'bg_removal', p_provider, p_cost_usd);
end;
$$;

create or replace function public.fail_garment_processing(
  p_garment_id uuid,
  p_user_id uuid,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.garments
  set status = 'failed',
      processing_error = left(coalesce(nullif(btrim(p_message), ''), 'Background removal failed. Try again.'), 160),
      processing_completed_at = now()
  where id = p_garment_id
    and user_id = p_user_id
    and status <> 'ready';
end;
$$;

revoke all on function public.claim_garment_processing(uuid, uuid) from public, anon, authenticated;
revoke all on function public.complete_garment_processing(uuid, uuid, text, text, text, numeric) from public, anon, authenticated;
revoke all on function public.fail_garment_processing(uuid, uuid, text) from public, anon, authenticated;

grant execute on function public.claim_garment_processing(uuid, uuid) to service_role;
grant execute on function public.complete_garment_processing(uuid, uuid, text, text, text, numeric) to service_role;
grant execute on function public.fail_garment_processing(uuid, uuid, text) to service_role;

commit;
