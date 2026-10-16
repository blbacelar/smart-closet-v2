-- Enforce C07 deadlines with a bounded, retry-safe database worker. Candidate
-- reads intentionally do not take row locks: every writer enters listing and
-- deletion advisory fences before row locks, preserving the global hierarchy.

alter table public.marketplace_offers
  add column expired_at timestamptz;

alter table public.marketplace_transactions
  add column expired_at timestamptz;

create index marketplace_pending_offer_expiry_idx
  on public.marketplace_offers(expires_at, id)
  where status = 'pending';

create index marketplace_open_handoff_expiry_idx
  on public.marketplace_transactions(handoff_deadline, id)
  where status = 'awaiting_handoff';

create table private.marketplace_expiry_failures (
  resource_type text not null check (resource_type in ('offer', 'transaction')),
  resource_id uuid not null,
  attempt_count integer not null default 1 check (attempt_count > 0),
  last_sqlstate text not null,
  next_retry_at timestamptz not null default (now() + interval '1 minute'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (resource_type, resource_id)
);

create index marketplace_expiry_failures_retry_idx
  on private.marketplace_expiry_failures(next_retry_at, resource_type, resource_id);

revoke all on private.marketplace_expiry_failures from public, anon, authenticated;

alter table public.marketplace_credit_ledger
  drop constraint marketplace_credit_ledger_kind_check,
  add constraint marketplace_credit_ledger_kind_check
    check (kind in (
      'membership_grant', 'renewal_grant', 'offer_reserve', 'offer_release',
      'transfer_out', 'transfer_in', 'cancellation_release',
      'expiration_release', 'adjustment'
    ));

create or replace function private.marketplace_mirror_legacy_credit_entry_from_row(
  p_entry public.marketplace_credit_ledger
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operation text;
  v_units bigint;
  v_cohort_id uuid;
  v_journal_id uuid;
begin
  if p_entry.kind = 'adjustment' then
    return private.marketplace_post_legacy_adjustment(p_entry);
  elsif p_entry.kind in ('membership_grant', 'renewal_grant') then
    v_operation := 'grant_available';
    v_units := p_entry.delta_available;
    insert into private.marketplace_grant_cohorts (
      party_id, source_event_key, terms_version, units
    ) values (
      p_entry.party_id, 'legacy:' || p_entry.idempotency_key, 'legacy-v1', v_units
    )
    on conflict (source_event_key) do nothing
    returning id into v_cohort_id;
    if v_cohort_id is null then
      select id into v_cohort_id
      from private.marketplace_grant_cohorts
      where source_event_key = 'legacy:' || p_entry.idempotency_key;
    end if;
  elsif p_entry.kind = 'offer_reserve' then
    v_operation := 'reserve';
    v_units := p_entry.delta_reserved;
  elsif p_entry.kind in (
    'offer_release', 'cancellation_release', 'expiration_release'
  ) then
    v_operation := 'release';
    v_units := p_entry.delta_available;
  elsif p_entry.kind = 'transfer_out' then
    v_operation := 'settle_out';
    v_units := -p_entry.delta_reserved;
  elsif p_entry.kind = 'transfer_in' then
    v_operation := 'settle_in';
    v_units := p_entry.delta_available;
  else
    raise exception 'Unsupported legacy marketplace credit entry';
  end if;

  if v_units is null or v_units <= 0 then
    raise exception 'Legacy marketplace credit entry has invalid units';
  end if;

  v_journal_id := private.marketplace_post_credit_operation(
    p_entry.party_id,
    v_operation,
    v_units,
    'legacy:' || p_entry.idempotency_key,
    'legacy-v1',
    null,
    v_cohort_id,
    jsonb_build_object(
      'legacy_ledger_id', p_entry.id,
      'offer_id', p_entry.offer_id,
      'transaction_id', p_entry.transaction_id
    ),
    false,
    true
  );

  return v_journal_id;
end;
$$;

create or replace function private.marketplace_guard_expired_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.expired_at is not null then
      raise exception 'Expiry time is worker-owned';
    end if;
    return new;
  end if;

  if old.expired_at is distinct from new.expired_at then
    if old.status <> 'expired' and new.status = 'expired'
      and old.expired_at is null then
      new.expired_at := coalesce(new.expired_at, now());
    else
      raise exception 'Expiry time is worker-owned';
    end if;
  elsif old.status <> 'expired' and new.status = 'expired' then
    new.expired_at := now();
  end if;

  return new;
end;
$$;

create trigger marketplace_expired_at_guard
before insert or update on public.marketplace_offers
for each row execute function private.marketplace_guard_expired_at();

create trigger marketplace_expired_at_guard
before insert or update on public.marketplace_transactions
for each row execute function private.marketplace_guard_expired_at();

-- The cron worker must never wait while holding a subset of its global lock
-- order. Try-locks make a busy candidate deferrable instead of deadlockable.
create or replace function private.marketplace_try_lock_listings(
  p_listing_ids uuid[]
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing_id uuid;
begin
  for v_listing_id in
    select distinct listing_id
    from unnest(coalesce(p_listing_ids, '{}'::uuid[])) listing_id
    where listing_id is not null
    order by listing_id
  loop
    if not pg_try_advisory_xact_lock(
      hashtextextended('marketplace-listing:' || v_listing_id::text, 7042026)
    ) then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

create or replace function private.account_deletion_try_lock_subjects(
  p_user_ids uuid[] default '{}'::uuid[],
  p_party_ids uuid[] default '{}'::uuid[]
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  for v_user_id in
    with subjects as (
      select unnest(coalesce(p_user_ids, '{}'::uuid[])) as user_id
      union
      select party.user_id
      from private.marketplace_parties party
      where party.id = any(coalesce(p_party_ids, '{}'::uuid[]))
      union
      select request.auth_user_id
      from private.account_deletion_requests request
      where request.party_id = any(coalesce(p_party_ids, '{}'::uuid[]))
    )
    select user_id from subjects where user_id is not null order by user_id::text
  loop
    if not pg_try_advisory_xact_lock(
      hashtextextended(v_user_id::text, 6042026)
    ) then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

create or replace function private.marketplace_record_expiry_failure(
  p_resource_type text,
  p_resource_id uuid,
  p_sqlstate text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_resource_type not in ('offer', 'transaction')
    or p_resource_id is null or p_sqlstate is null then
    raise invalid_parameter_value using message = 'Invalid expiry failure';
  end if;

  insert into private.marketplace_expiry_failures (
    resource_type, resource_id, last_sqlstate
  ) values (
    p_resource_type, p_resource_id, p_sqlstate
  )
  on conflict (resource_type, resource_id) do update
  set attempt_count = private.marketplace_expiry_failures.attempt_count + 1,
      last_sqlstate = excluded.last_sqlstate,
      next_retry_at = now() + (
        least(
          60,
          power(
            2,
            least(private.marketplace_expiry_failures.attempt_count, 6)
          )::integer
        ) * interval '1 minute'
      ),
      updated_at = now();
end;
$$;

create or replace function public.marketplace_expire_stale(
  p_now timestamptz default now(),
  p_limit integer default 100
)
returns table (
  offers_expired integer,
  transactions_expired integer,
  transactions_disputed integer,
  items_deferred integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer_id uuid;
  v_offer public.marketplace_offers%rowtype;
  v_tx_id uuid;
  v_tx public.marketplace_transactions%rowtype;
  v_ledger_id uuid;
  v_expected_listings integer;
  v_reserved_listings integer;
  v_reserved_balance bigint;
  v_sqlstate text;
begin
  if p_now is null then
    raise invalid_parameter_value using message = 'Expiry cutoff is required';
  end if;
  if p_limit is null or p_limit not between 1 and 1000 then
    raise invalid_parameter_value using message = 'Expiry batch limit must be between 1 and 1000';
  end if;

  offers_expired := 0;
  transactions_expired := 0;
  transactions_disputed := 0;
  items_deferred := 0;

  -- Supabase cron can overlap after a slow run. Only one expiry batch needs to
  -- make progress; the loser returns immediately instead of cross-deferring
  -- candidates whose participant gates are held by the winning batch.
  if not pg_try_advisory_xact_lock(
    hashtextextended('marketplace-expiry-worker', 8042026)
  ) then
    return next;
    return;
  end if;

  for v_offer_id in
    select offer_record.id
    from public.marketplace_offers offer_record
    where offer_record.status = 'pending'
      and offer_record.expires_at <= p_now
      and not exists (
        select 1
        from private.marketplace_expiry_failures failure
        where failure.resource_type = 'offer'
          and failure.resource_id = offer_record.id
          and failure.next_retry_at > now()
      )
    order by offer_record.expires_at, offer_record.id
    limit p_limit
  loop
    select * into v_offer
    from public.marketplace_offers
    where id = v_offer_id;
    if not found or v_offer.status <> 'pending'
      or v_offer.expires_at > p_now then
      continue;
    end if;

    if not private.marketplace_try_lock_listings(
      array[v_offer.listing_id, v_offer.swap_listing_id]
    ) or not private.account_deletion_try_lock_subjects(
      array[v_offer.buyer_id, v_offer.seller_id],
      array[v_offer.buyer_party_id, v_offer.seller_party_id]
    ) then
      perform private.marketplace_record_expiry_failure('offer', v_offer_id, '55P03');
      items_deferred := items_deferred + 1;
      continue;
    end if;

    begin
      select * into v_offer
      from public.marketplace_offers
      where id = v_offer_id
      for update nowait;
      if not found or v_offer.status <> 'pending'
        or v_offer.expires_at > p_now then
        delete from private.marketplace_expiry_failures
        where resource_type = 'offer' and resource_id = v_offer_id;
        continue;
      end if;

      perform private.marketplace_release_offer(v_offer.id, 'expired');
      if (select status from public.marketplace_offers where id = v_offer.id) = 'expired' then
        offers_expired := offers_expired + 1;
        delete from private.marketplace_expiry_failures
        where resource_type = 'offer' and resource_id = v_offer_id;
      end if;
    exception when others then
      get stacked diagnostics v_sqlstate = returned_sqlstate;
      perform private.marketplace_record_expiry_failure('offer', v_offer_id, v_sqlstate);
      items_deferred := items_deferred + 1;
    end;
  end loop;

  for v_tx_id in
    select transaction_record.id
    from public.marketplace_transactions transaction_record
    where transaction_record.status = 'awaiting_handoff'
      and transaction_record.handoff_deadline <= p_now
      and not exists (
        select 1
        from private.marketplace_expiry_failures failure
        where failure.resource_type = 'transaction'
          and failure.resource_id = transaction_record.id
          and failure.next_retry_at > now()
      )
    order by transaction_record.handoff_deadline, transaction_record.id
    limit p_limit
  loop
    select * into v_tx
    from public.marketplace_transactions
    where id = v_tx_id;
    if not found or v_tx.status <> 'awaiting_handoff'
      or v_tx.handoff_deadline > p_now then
      continue;
    end if;

    if not private.marketplace_try_lock_listings(
      array[v_tx.listing_id, v_tx.swap_listing_id]
    ) or not private.account_deletion_try_lock_subjects(
      array[v_tx.buyer_id, v_tx.seller_id],
      array[v_tx.buyer_party_id, v_tx.seller_party_id]
    ) then
      perform private.marketplace_record_expiry_failure('transaction', v_tx_id, '55P03');
      items_deferred := items_deferred + 1;
      continue;
    end if;

    begin
      perform 1
      from public.marketplace_listings
      where id = v_tx.listing_id or id = v_tx.swap_listing_id
      order by id
      for update nowait;

      select * into v_tx
      from public.marketplace_transactions
      where id = v_tx_id
      for update nowait;
      if not found or v_tx.status <> 'awaiting_handoff'
        or v_tx.handoff_deadline > p_now then
        delete from private.marketplace_expiry_failures
        where resource_type = 'transaction' and resource_id = v_tx_id;
        continue;
      end if;

      -- A single confirmation may mean physical handoff already occurred. Freeze
      -- value and listings for C15 rather than guessing that it is safe to undo.
      if v_tx.buyer_confirmed_at is not null
        or v_tx.seller_confirmed_at is not null then
        update public.marketplace_transactions
        set status = 'disputed', updated_at = now()
        where id = v_tx.id;
        transactions_disputed := transactions_disputed + 1;
        delete from private.marketplace_expiry_failures
        where resource_type = 'transaction' and resource_id = v_tx_id;
        continue;
      end if;

      v_expected_listings := case when v_tx.swap_listing_id is null then 1 else 2 end;
      select count(*)::integer into v_reserved_listings
      from public.marketplace_listings
      where (id = v_tx.listing_id or id = v_tx.swap_listing_id)
        and status = 'reserved';
      if v_reserved_listings <> v_expected_listings then
        update public.marketplace_transactions
        set status = 'disputed', updated_at = now()
        where id = v_tx.id;
        perform private.marketplace_record_expiry_failure('transaction', v_tx_id, 'P0001');
        transactions_disputed := transactions_disputed + 1;
        continue;
      end if;

      if v_tx.mode = 'credits' then
        select reserved_balance into v_reserved_balance
        from public.marketplace_credit_accounts
        where party_id = v_tx.buyer_party_id
        for update nowait;
        if not found or v_reserved_balance < v_tx.credit_amount then
          update public.marketplace_transactions
          set status = 'disputed', updated_at = now()
          where id = v_tx.id;
          perform private.marketplace_record_expiry_failure('transaction', v_tx_id, 'P0001');
          transactions_disputed := transactions_disputed + 1;
          continue;
        end if;

        v_ledger_id := null;
        insert into public.marketplace_credit_ledger (
          user_id, party_id, offer_id, transaction_id, kind,
          delta_available, delta_reserved, idempotency_key, description
        ) values (
          v_tx.buyer_id, v_tx.buyer_party_id, v_tx.offer_id, v_tx.id,
          'expiration_release', v_tx.credit_amount, -v_tx.credit_amount,
          'transaction:' || v_tx.id::text || ':expire',
          'Credits released after marketplace handoff expiry'
        )
        on conflict (idempotency_key) do nothing
        returning id into v_ledger_id;

        if v_ledger_id is null then
          update public.marketplace_transactions
          set status = 'disputed', updated_at = now()
          where id = v_tx.id;
          perform private.marketplace_record_expiry_failure('transaction', v_tx_id, '23505');
          transactions_disputed := transactions_disputed + 1;
          continue;
        end if;

        update public.marketplace_credit_accounts
        set available_balance = available_balance + v_tx.credit_amount,
            reserved_balance = reserved_balance - v_tx.credit_amount,
            updated_at = now()
        where party_id = v_tx.buyer_party_id
          and reserved_balance >= v_tx.credit_amount;
        if not found then
          raise exception 'Reserved credit balance is inconsistent';
        end if;
      end if;

      update public.marketplace_transactions
      set status = 'expired', updated_at = now()
      where id = v_tx.id;
      update public.marketplace_listings
      set status = 'active', updated_at = now()
      where (id = v_tx.listing_id or id = v_tx.swap_listing_id)
        and status = 'reserved';
      transactions_expired := transactions_expired + 1;
      delete from private.marketplace_expiry_failures
      where resource_type = 'transaction' and resource_id = v_tx_id;
    exception when others then
      get stacked diagnostics v_sqlstate = returned_sqlstate;
      perform private.marketplace_record_expiry_failure('transaction', v_tx_id, v_sqlstate);
      items_deferred := items_deferred + 1;
    end;
  end loop;

  return next;
end;
$$;

revoke all on function private.marketplace_guard_expired_at() from public, anon, authenticated;
revoke all on function private.marketplace_try_lock_listings(uuid[]) from public, anon, authenticated;
revoke all on function private.account_deletion_try_lock_subjects(uuid[], uuid[]) from public, anon, authenticated;
revoke all on function private.marketplace_record_expiry_failure(text, uuid, text) from public, anon, authenticated;
revoke all on function public.marketplace_expire_stale(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.marketplace_expire_stale(timestamptz, integer) to service_role;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'fitly-marketplace-expiry';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'fitly-marketplace-expiry',
    '* * * * *',
    $job$select * from public.marketplace_expire_stale()$job$
  );
end;
$$;

-- Rollback: unschedule fitly-marketplace-expiry and ship a forward migration.
-- Never remove expiry ledger evidence or rewrite terminal states.
