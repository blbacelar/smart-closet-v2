begin;

alter table public.ai_cost_ledger
  drop constraint ai_cost_ledger_kind_check;

alter table public.ai_cost_ledger
  add constraint ai_cost_ledger_kind_check
  check (kind in ('tryon', 'bg_removal', 'moderation', 'garment_tagging'));

drop policy if exists "garments_insert_own_processing" on public.garments;

create policy "garments_insert_own_processing"
on public.garments
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'processing'
  and clean_path is null
  and image_hash is null
  and name is not null
  and length(btrim(name)) between 1 and 80
  and (category is null or category in ('top', 'bottom', 'dress', 'outerwear', 'shoes'))
  and coalesce(length(color), 0) <= 40
  and coalesce(length(size), 0) <= 40
  and coalesce(length(season), 0) <= 40
);

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
      'attempt', garment.processing_attempts,
      'category', garment.category
    )
  );
end;
$$;

drop function public.complete_garment_processing(uuid, uuid, text, text, text, numeric);

create function public.complete_garment_processing(
  p_garment_id uuid,
  p_user_id uuid,
  p_clean_path text,
  p_image_hash text,
  p_provider text,
  p_cost_usd numeric,
  p_category text,
  p_category_provider text,
  p_category_cost_usd numeric
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
    or p_cost_usd < 0
    or p_category not in ('top', 'bottom', 'dress', 'outerwear', 'shoes')
    or (p_category_provider is null) <> (p_category_cost_usd is null)
    or (p_category_provider is not null and length(btrim(p_category_provider)) = 0)
    or (p_category_cost_usd is not null and p_category_cost_usd < 0) then
    raise exception 'Invalid garment processing result.' using errcode = '22023';
  end if;

  update public.garments
  set clean_path = p_clean_path,
      image_hash = p_image_hash,
      category = coalesce(category, p_category),
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

  if p_category_provider is not null then
    insert into public.ai_cost_ledger (user_id, kind, provider, cost_usd)
    values (p_user_id, 'garment_tagging', p_category_provider, p_category_cost_usd);
  end if;
end;
$$;

revoke all on function public.claim_garment_processing(uuid, uuid) from public, anon, authenticated;
revoke all on function public.complete_garment_processing(uuid, uuid, text, text, text, numeric, text, text, numeric) from public, anon, authenticated;

grant execute on function public.claim_garment_processing(uuid, uuid) to service_role;
grant execute on function public.complete_garment_processing(uuid, uuid, text, text, text, numeric, text, text, numeric) to service_role;

commit;
