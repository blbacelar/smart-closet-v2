begin;

-- Forward rollback: add a new migration that revokes these RPCs and removes
-- the optional validation metadata only after deployed code no longer uses it.
alter table public.body_photos
  add column validation_attempts integer not null default 0
    check (validation_attempts between 0 and 3),
  add column validation_started_at timestamptz,
  add column validation_completed_at timestamptz,
  add column validation_error text;

create or replace function public.claim_body_photo_validation(
  p_photo_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  photo public.body_photos%rowtype;
begin
  select *
  into photo
  from public.body_photos
  where id = p_photo_id
    and user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('state', 'not-found');
  end if;

  if photo.status in ('approved', 'rejected') then
    return jsonb_build_object('state', photo.status);
  end if;

  if photo.validation_attempts >= 3 then
    return jsonb_build_object('state', 'exhausted');
  end if;

  if photo.validation_started_at is not null
    and photo.validation_started_at >= now() - interval '2 minutes' then
    return jsonb_build_object('state', 'busy');
  end if;

  update public.body_photos
  set validation_attempts = validation_attempts + 1,
      validation_started_at = now(),
      validation_completed_at = null,
      validation_error = null
  where id = photo.id
  returning * into photo;

  return jsonb_build_object(
    'state', 'claimed',
    'photo', jsonb_build_object(
      'id', photo.id,
      'userId', photo.user_id,
      'storagePath', photo.storage_path,
      'attempt', photo.validation_attempts
    )
  );
end;
$$;

create or replace function public.complete_body_photo_validation(
  p_photo_id uuid,
  p_user_id uuid,
  p_attempt integer,
  p_decision text,
  p_reject_reason text,
  p_provider text,
  p_cost_usd numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_decision not in ('approved', 'rejected')
    or (p_decision = 'approved' and p_reject_reason is not null)
    or (p_decision = 'rejected' and (p_reject_reason is null or p_reject_reason not in (
      'adult_content',
      'age_not_confirmed',
      'no_single_person',
      'not_full_body',
      'poor_quality'
    )))
    or length(btrim(p_provider)) = 0
    or p_cost_usd < 0 then
    raise exception 'Invalid body-photo validation result.' using errcode = '22023';
  end if;

  update public.body_photos
  set status = p_decision,
      reject_reason = p_reject_reason,
      validation_error = null,
      validation_completed_at = now()
  where id = p_photo_id
    and user_id = p_user_id
    and status = 'pending'
    and validation_attempts = p_attempt
    and validation_started_at is not null;

  if not found then
    raise exception 'Body photo is not awaiting this validation attempt.' using errcode = '55000';
  end if;

  insert into public.ai_cost_ledger (user_id, kind, provider, cost_usd)
  values (p_user_id, 'moderation', p_provider, p_cost_usd);
end;
$$;

create or replace function private.require_approved_tryon_body_photo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.body_photos
    where id = new.body_photo_id
      and user_id = new.user_id
      and status = 'approved'
  ) then
    raise check_violation using message = 'Body photo must be approved.';
  end if;
  return new;
end;
$$;

create trigger require_approved_tryon_body_photo
  before insert or update of body_photo_id, user_id
  on public.tryon_jobs
  for each row execute function private.require_approved_tryon_body_photo();

create or replace function public.fail_body_photo_validation(
  p_photo_id uuid,
  p_user_id uuid,
  p_attempt integer,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.body_photos
  set validation_error = left(
        coalesce(nullif(btrim(p_message), ''), 'Photo validation is temporarily unavailable. Try again.'),
        160
      ),
      validation_started_at = null
  where id = p_photo_id
    and user_id = p_user_id
    and status = 'pending'
    and validation_attempts = p_attempt;
end;
$$;

revoke all on function public.claim_body_photo_validation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.complete_body_photo_validation(uuid, uuid, integer, text, text, text, numeric) from public, anon, authenticated;
revoke all on function public.fail_body_photo_validation(uuid, uuid, integer, text) from public, anon, authenticated;

grant execute on function public.claim_body_photo_validation(uuid, uuid) to service_role;
grant execute on function public.complete_body_photo_validation(uuid, uuid, integer, text, text, text, numeric) to service_role;
grant execute on function public.fail_body_photo_validation(uuid, uuid, integer, text) to service_role;

revoke all on function private.require_approved_tryon_body_photo() from public, anon, authenticated;

commit;
