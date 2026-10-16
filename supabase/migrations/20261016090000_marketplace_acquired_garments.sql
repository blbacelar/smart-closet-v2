-- C09 keeps seller closet rows and storage objects private. A participant
-- confirmation prepares deterministic recipient-owned copy paths; only the
-- service-role Edge Function may finalize after Storage confirms those copies.

create table private.marketplace_acquisitions (
  transaction_id uuid not null
    references public.marketplace_transactions(id) on delete restrict,
  source_listing_id uuid not null
    references public.marketplace_listings(id) on delete restrict,
  recipient_party_id uuid not null
    references private.marketplace_parties(id) on delete restrict,
  planned_garment_id uuid not null unique,
  acquired_garment_id uuid
    references public.garments(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (transaction_id, source_listing_id),
  unique (acquired_garment_id),
  check (
    (completed_at is null and acquired_garment_id is null)
    or (completed_at is not null)
  )
);

revoke all on private.marketplace_acquisitions from public, anon, authenticated;

create or replace function private.marketplace_guard_acquisition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Marketplace acquisition provenance is immutable';
  end if;

  if old.transaction_id is distinct from new.transaction_id
    or old.source_listing_id is distinct from new.source_listing_id
    or old.recipient_party_id is distinct from new.recipient_party_id
    or old.planned_garment_id is distinct from new.planned_garment_id
    or old.created_at is distinct from new.created_at then
    raise exception 'Marketplace acquisition provenance is immutable';
  end if;

  if old.completed_at is null then
    if new.completed_at is null
      or new.acquired_garment_id is distinct from old.planned_garment_id then
      raise exception 'Marketplace acquisition completion is invalid';
    end if;
  elsif not (
    old.completed_at is not distinct from new.completed_at
    and old.acquired_garment_id is not null
    and new.acquired_garment_id is null
  ) then
    raise exception 'Marketplace acquisition provenance is immutable';
  end if;

  return new;
end;
$$;

create trigger marketplace_acquisition_guard
before update or delete on private.marketplace_acquisitions
for each row execute function private.marketplace_guard_acquisition();

-- The second handoff confirmation creates acquisition plans before Storage is
-- copied. Prevent every terminal writer, including the C08 expiry worker, from
-- moving that transaction away from settlement while those plans are pending.
create or replace function private.marketplace_guard_settlement_fence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'awaiting_handoff'
    and new.status in ('cancelled', 'disputed', 'expired')
    and exists (
      select 1 from private.marketplace_acquisitions acquisition
      where acquisition.transaction_id = old.id
        and acquisition.completed_at is null
    ) then
    raise exception 'Marketplace acquisitions are pending'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger marketplace_settlement_fence
before update on public.marketplace_transactions
for each row execute function private.marketplace_guard_settlement_fence();

create trigger account_deletion_write_barrier
before insert on private.marketplace_acquisitions
for each row execute function private.account_deletion_reject_write(
  'party:recipient_party_id'
);

-- Acquisitions represent a physical handoff and must not fail because the
-- recipient already reached the upload quota. They still count toward future
-- closet-limit checks.
create or replace function private.enforce_garment_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_tier text;
  existing_count integer;
begin
  if exists (
    select 1
    from private.marketplace_acquisitions acquisition
    where acquisition.planned_garment_id = new.id
  ) then
    return new;
  end if;

  select tier
  into user_tier
  from public.profiles
  where id = new.user_id
  for update;

  if user_tier = 'free' then
    select count(*)
    into existing_count
    from public.garments
    where user_id = new.user_id;

    if existing_count >= 50 then
      raise exception 'Garment limit reached for current plan.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.marketplace_acquisition_path(
  p_user_id uuid,
  p_garment_id uuid,
  p_variant text
)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select p_user_id::text || '/acquired/' || p_garment_id::text || '/' || p_variant;
$$;

create or replace function public.marketplace_record_handoff_confirmation(
  p_transaction_id uuid,
  p_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.marketplace_transactions%rowtype;
  v_now timestamptz := now();
begin
  if p_user_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_tx
  from public.marketplace_transactions
  where id = p_transaction_id;
  if not found or p_user_id not in (v_tx.buyer_id, v_tx.seller_id) then
    raise exception 'Transaction not found';
  end if;

  perform private.account_deletion_lock_subjects(
    array[v_tx.buyer_id, v_tx.seller_id],
    array[v_tx.buyer_party_id, v_tx.seller_party_id]
  );

  select * into v_tx
  from public.marketplace_transactions
  where id = p_transaction_id
  for update;
  if not found or p_user_id not in (v_tx.buyer_id, v_tx.seller_id) then
    raise exception 'Transaction not found';
  end if;
  if v_tx.status = 'completed' then return 'completed'; end if;
  if v_tx.status <> 'awaiting_handoff' then
    raise exception 'Transaction cannot be confirmed';
  end if;

  if p_user_id = v_tx.buyer_id then
    v_tx.buyer_confirmed_at := coalesce(v_tx.buyer_confirmed_at, v_now);
  end if;
  if p_user_id = v_tx.seller_id then
    v_tx.seller_confirmed_at := coalesce(v_tx.seller_confirmed_at, v_now);
  end if;

  update public.marketplace_transactions
  set buyer_confirmed_at = v_tx.buyer_confirmed_at,
      seller_confirmed_at = v_tx.seller_confirmed_at,
      updated_at = v_now
  where id = v_tx.id;

  if v_tx.buyer_confirmed_at is null
    or v_tx.seller_confirmed_at is null then
    return 'awaiting_handoff';
  end if;

  insert into private.marketplace_acquisitions (
    transaction_id, source_listing_id, recipient_party_id, planned_garment_id
  ) values (
    v_tx.id, v_tx.listing_id, v_tx.buyer_party_id, gen_random_uuid()
  )
  on conflict (transaction_id, source_listing_id) do nothing;

  if v_tx.swap_listing_id is not null then
    insert into private.marketplace_acquisitions (
      transaction_id, source_listing_id, recipient_party_id, planned_garment_id
    ) values (
      v_tx.id, v_tx.swap_listing_id, v_tx.seller_party_id, gen_random_uuid()
    )
    on conflict (transaction_id, source_listing_id) do nothing;
  end if;

  return 'settlement_pending';
end;
$$;

create or replace function public.marketplace_confirm_handoff(p_transaction_id uuid)
returns text
language sql
security definer
set search_path = ''
as $$
  select public.marketplace_record_handoff_confirmation(
    p_transaction_id,
    (select auth.uid())
  );
$$;

create or replace function public.marketplace_acquisition_manifest(
  p_transaction_id uuid
)
returns table (
  acquired_garment_id uuid,
  source_marketplace_path text,
  destination_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    acquisition.planned_garment_id,
    coalesce(source.clean_path, source.original_path),
    private.marketplace_acquisition_path(
      party.user_id, acquisition.planned_garment_id, 'asset'
    )
  from private.marketplace_acquisitions acquisition
  join public.marketplace_transactions transaction_record
    on transaction_record.id = acquisition.transaction_id
  join public.marketplace_listings listing
    on listing.id = acquisition.source_listing_id
  join public.garments source on source.id = listing.garment_id
  join private.marketplace_parties party
    on party.id = acquisition.recipient_party_id
  where acquisition.transaction_id = p_transaction_id
    and transaction_record.status in ('awaiting_handoff', 'completed')
    and transaction_record.buyer_confirmed_at is not null
    and transaction_record.seller_confirmed_at is not null
    and party.user_id is not null
  order by acquisition.source_listing_id;
$$;

create or replace function public.marketplace_finalize_handoff(
  p_transaction_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.marketplace_transactions%rowtype;
  v_acquisition record;
  v_expected integer;
  v_actual integer;
  v_now timestamptz := now();
begin
  select * into v_tx
  from public.marketplace_transactions
  where id = p_transaction_id;
  if not found then raise exception 'Transaction not found'; end if;

  perform private.marketplace_lock_listings(
    array[v_tx.listing_id, v_tx.swap_listing_id]
  );
  perform private.account_deletion_lock_subjects(
    array[v_tx.buyer_id, v_tx.seller_id],
    array[v_tx.buyer_party_id, v_tx.seller_party_id]
  );

  perform 1
  from public.marketplace_listings
  where id = v_tx.listing_id or id = v_tx.swap_listing_id
  order by id
  for update;

  select * into v_tx
  from public.marketplace_transactions
  where id = p_transaction_id
  for update;
  if v_tx.status = 'completed' then return 'completed'; end if;
  if v_tx.status <> 'awaiting_handoff'
    or v_tx.buyer_confirmed_at is null
    or v_tx.seller_confirmed_at is null then
    raise exception 'Transaction is not ready for settlement';
  end if;

  v_expected := case when v_tx.swap_listing_id is null then 1 else 2 end;
  select count(*)::integer into v_actual
  from private.marketplace_acquisitions
  where transaction_id = v_tx.id;
  if v_actual <> v_expected then
    raise exception 'Marketplace acquisition plan is incomplete';
  end if;

  for v_acquisition in
    select
      acquisition.source_listing_id,
      acquisition.recipient_party_id,
      acquisition.planned_garment_id,
      party.user_id recipient_user_id,
      source.name, source.category, source.color, source.size, source.season,
      private.marketplace_acquisition_path(
        party.user_id, acquisition.planned_garment_id, 'asset'
      ) destination_path
    from private.marketplace_acquisitions acquisition
    join public.marketplace_listings listing
      on listing.id = acquisition.source_listing_id
    join public.garments source on source.id = listing.garment_id
    join private.marketplace_parties party
      on party.id = acquisition.recipient_party_id
    where acquisition.transaction_id = v_tx.id
    order by acquisition.source_listing_id
  loop
    if v_acquisition.recipient_user_id is null
      or not exists (
        select 1 from storage.objects object_record
        where object_record.bucket_id = 'garments'
          and object_record.name = v_acquisition.destination_path
      ) then
      raise exception 'Acquired garment storage copy is incomplete';
    end if;

    insert into public.garments (
      id, user_id, original_path, clean_path,
      image_hash, processing_attempts, processing_error,
      processing_started_at, processing_completed_at,
      name, category, color, size, season, status
    ) values (
      v_acquisition.planned_garment_id,
      v_acquisition.recipient_user_id,
      v_acquisition.destination_path,
      null,
      null, 0, null, null, v_now,
      v_acquisition.name, v_acquisition.category, v_acquisition.color,
      v_acquisition.size, v_acquisition.season, 'ready'
    )
    on conflict (id) do nothing;

    perform 1
    from public.garments garment
    where garment.id = v_acquisition.planned_garment_id
      and garment.user_id = v_acquisition.recipient_user_id
      and garment.original_path = v_acquisition.destination_path
      and garment.clean_path is null
    for update;
    if not found then
      raise exception 'Acquired garment identity is inconsistent';
    end if;

    update private.marketplace_acquisitions
    set acquired_garment_id = planned_garment_id,
        completed_at = v_now
    where transaction_id = v_tx.id
      and source_listing_id = v_acquisition.source_listing_id
      and completed_at is null;
  end loop;

  if v_tx.mode = 'credits' then
    update public.marketplace_credit_accounts
    set reserved_balance = reserved_balance - v_tx.credit_amount,
        updated_at = v_now
    where party_id = v_tx.buyer_party_id
      and reserved_balance >= v_tx.credit_amount;
    if not found then
      raise exception 'Reserved credit balance is inconsistent';
    end if;

    insert into public.marketplace_credit_accounts (user_id, party_id)
    values (v_tx.seller_id, v_tx.seller_party_id)
    on conflict (party_id) do nothing;
    update public.marketplace_credit_accounts
    set available_balance = available_balance + v_tx.credit_amount,
        updated_at = v_now
    where party_id = v_tx.seller_party_id;

    insert into public.marketplace_credit_ledger (
      user_id, party_id, transaction_id, kind,
      delta_available, delta_reserved, idempotency_key, description
    ) values
      (
        v_tx.buyer_id, v_tx.buyer_party_id, v_tx.id, 'transfer_out',
        0, -v_tx.credit_amount, 'transaction:' || v_tx.id::text || ':out',
        'Credits transferred for a completed exchange'
      ),
      (
        v_tx.seller_id, v_tx.seller_party_id, v_tx.id, 'transfer_in',
        v_tx.credit_amount, 0, 'transaction:' || v_tx.id::text || ':in',
        'Credits earned from a completed exchange'
      );
  end if;

  update public.marketplace_transactions
  set status = 'completed', completed_at = v_now, updated_at = v_now
  where id = v_tx.id;
  delete from private.marketplace_expiry_failures
  where resource_type = 'transaction' and resource_id = v_tx.id;
  update public.marketplace_listings
  set status = 'completed', updated_at = v_now
  where id = v_tx.listing_id or id = v_tx.swap_listing_id;
  update public.garments garment
  set marketplace_archived_at = v_now
  where exists (
    select 1 from public.marketplace_listings listing
    where listing.garment_id = garment.id
      and (listing.id = v_tx.listing_id or listing.id = v_tx.swap_listing_id)
  );

  return 'completed';
end;
$$;

create or replace function public.marketplace_acquisition_reconciliation()
returns table (
  transaction_id uuid,
  source_listing_id uuid,
  anomaly text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    acquisition.transaction_id,
    acquisition.source_listing_id,
    case
      when acquisition.completed_at is null then 'provenance_incomplete'
      when acquisition.acquired_garment_id is null then 'garment_missing'
      when garment.user_id is distinct from party.user_id then 'recipient_mismatch'
      else 'path_mismatch'
    end
  from private.marketplace_acquisitions acquisition
  join public.marketplace_transactions transaction_record
    on transaction_record.id = acquisition.transaction_id
  join private.marketplace_parties party
    on party.id = acquisition.recipient_party_id
  left join public.garments garment
    on garment.id = acquisition.acquired_garment_id
  where transaction_record.status = 'completed'
    and party.user_id is not null
    and (
      acquisition.completed_at is null
      or acquisition.acquired_garment_id is null
      or garment.user_id is distinct from party.user_id
      or garment.original_path is distinct from private.marketplace_acquisition_path(
        party.user_id, acquisition.planned_garment_id, 'asset'
      )
      or garment.clean_path is not null
    );
$$;

create or replace function public.marketplace_can_mutate_garment_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    not exists (
      select 1
      from public.marketplace_listings listing
      join public.garments garment on garment.id = listing.garment_id
      where p_name in (garment.original_path, garment.clean_path)
        and (
          listing.status in ('active', 'reserved')
          or exists (
            select 1 from public.marketplace_transactions transaction_record
            where (
                transaction_record.listing_id = listing.id
                or transaction_record.swap_listing_id = listing.id
              )
              and transaction_record.status in ('awaiting_handoff', 'disputed')
          )
        )
    )
    and not exists (
      select 1
      from private.marketplace_acquisitions acquisition
      join private.marketplace_parties party
        on party.id = acquisition.recipient_party_id
      where acquisition.completed_at is null
        and party.user_id is not null
        and p_name = private.marketplace_acquisition_path(
          party.user_id, acquisition.planned_garment_id, 'asset'
        )
    );
$$;

revoke all on function public.marketplace_can_mutate_garment_object(text) from public, anon;
grant execute on function public.marketplace_can_mutate_garment_object(text) to authenticated;

drop policy if exists "private_source_image_insert" on storage.objects;
create policy "private_source_image_insert" on storage.objects for insert to authenticated
with check (
  bucket_id in ('body', 'garments')
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and adult_confirmed_at is not null
  )
  and public.account_deletion_write_allowed()
  and (
    bucket_id <> 'garments'
    or public.marketplace_can_mutate_garment_object(name)
  )
);

drop policy if exists "private_image_delete" on storage.objects;
create policy "private_image_delete" on storage.objects for delete to authenticated
using (
  bucket_id in ('body', 'garments', 'results')
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.profiles where id = (select auth.uid())
  )
  and public.account_deletion_write_allowed()
  and (
    bucket_id <> 'garments'
    or public.marketplace_can_mutate_garment_object(name)
  )
);

revoke all on function private.marketplace_guard_acquisition() from public, anon, authenticated;
revoke all on function private.marketplace_guard_settlement_fence() from public, anon, authenticated;
revoke all on function private.marketplace_acquisition_path(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.marketplace_record_handoff_confirmation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.marketplace_confirm_handoff(uuid) from public, anon;
revoke all on function public.marketplace_acquisition_manifest(uuid) from public, anon, authenticated;
revoke all on function public.marketplace_finalize_handoff(uuid) from public, anon, authenticated;
revoke all on function public.marketplace_acquisition_reconciliation() from public, anon, authenticated;

grant execute on function public.marketplace_confirm_handoff(uuid) to authenticated;
grant execute on function public.marketplace_record_handoff_confirmation(uuid, uuid) to service_role;
grant execute on function public.marketplace_acquisition_manifest(uuid) to service_role;
grant execute on function public.marketplace_finalize_handoff(uuid) to service_role;
grant execute on function public.marketplace_acquisition_reconciliation() to service_role;

-- Rollback: pause settlement and ship a forward migration. Preserve completed
-- garment copies, transaction history and acquisition provenance.
