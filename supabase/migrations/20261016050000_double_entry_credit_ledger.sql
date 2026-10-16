-- Expand the development credit economy into a restricted, append-only,
-- double-entry ledger. Existing public balance tables remain compatibility
-- projections until the transaction state machine is migrated in C07.

create table private.marketplace_grant_cohorts (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references private.marketplace_parties(id) on delete restrict,
  source_event_key text not null unique,
  terms_version text not null,
  units bigint not null check (units > 0),
  initial_state text not null default 'available'
    check (initial_state in ('pending', 'available')),
  granted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table private.marketplace_ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  party_id uuid references private.marketplace_parties(id) on delete restrict,
  code text not null unique,
  kind text not null check (kind in (
    'member_pending', 'member_available', 'member_held',
    'system_issuance', 'system_escrow', 'system_retirement',
    'system_platform_loss', 'system_platform_debt', 'system_fees', 'system_taxes'
  )),
  balance bigint not null default 0,
  created_at timestamptz not null default now(),
  check (
    (kind in ('member_pending', 'member_available', 'member_held') and party_id is not null)
    or
    (kind like 'system_%' and party_id is null)
  )
);

create unique index marketplace_ledger_member_account_kind_idx
  on private.marketplace_ledger_accounts(party_id, kind)
  where party_id is not null;

create table private.marketplace_ledger_journals (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  request_party_id uuid not null references private.marketplace_parties(id) on delete restrict,
  request_units bigint not null check (request_units > 0),
  idempotency_key text not null,
  external_event_key text,
  terms_version text not null,
  reason_version text not null default 'v1',
  grant_cohort_id uuid references private.marketplace_grant_cohorts(id) on delete restrict,
  reversal_of uuid unique references private.marketplace_ledger_journals(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  posted_at timestamptz not null default now(),
  unique (idempotency_key),
  unique (external_event_key),
  check (char_length(trim(kind)) between 1 and 80),
  check (char_length(trim(idempotency_key)) between 1 and 240),
  check (jsonb_typeof(metadata) = 'object')
);

create unique index marketplace_ledger_grant_cohort_issuance_idx
  on private.marketplace_ledger_journals(grant_cohort_id)
  where grant_cohort_id is not null;

create table private.marketplace_ledger_postings (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references private.marketplace_ledger_journals(id) on delete restrict,
  account_id uuid not null references private.marketplace_ledger_accounts(id) on delete restrict,
  units bigint not null check (units <> 0),
  created_at timestamptz not null default now(),
  unique (journal_id, account_id)
);

create index marketplace_ledger_postings_account_idx
  on private.marketplace_ledger_postings(account_id, created_at desc);

revoke all on private.marketplace_grant_cohorts from public, anon, authenticated;
revoke all on private.marketplace_ledger_accounts from public, anon, authenticated;
revoke all on private.marketplace_ledger_journals from public, anon, authenticated;
revoke all on private.marketplace_ledger_postings from public, anon, authenticated;

create or replace function private.marketplace_reject_ledger_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Posted marketplace ledger records are immutable';
end;
$$;

create trigger marketplace_ledger_journals_immutable
before update or delete on private.marketplace_ledger_journals
for each row execute function private.marketplace_reject_ledger_mutation();

create trigger marketplace_ledger_postings_immutable
before update or delete on private.marketplace_ledger_postings
for each row execute function private.marketplace_reject_ledger_mutation();

create trigger marketplace_grant_cohorts_immutable
before update or delete on private.marketplace_grant_cohorts
for each row execute function private.marketplace_reject_ledger_mutation();

create or replace function private.marketplace_assert_balanced_journal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_journal_id uuid := coalesce(new.journal_id, old.journal_id);
  v_posting_count bigint;
  v_total bigint;
begin
  select count(*), coalesce(sum(units), 0)
  into v_posting_count, v_total
  from private.marketplace_ledger_postings
  where journal_id = v_journal_id;

  if v_posting_count < 2 or v_total <> 0 then
    raise exception 'Marketplace journal % is not balanced', v_journal_id;
  end if;

  return null;
end;
$$;

create constraint trigger marketplace_ledger_balance_check
after insert or update or delete on private.marketplace_ledger_postings
deferrable initially deferred
for each row execute function private.marketplace_assert_balanced_journal();

create or replace function private.marketplace_ledger_account(
  p_party_id uuid,
  p_kind text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_id uuid;
  v_code text;
begin
  if p_kind in ('member_pending', 'member_available', 'member_held') then
    if p_party_id is null then
      raise exception 'A party is required for a member ledger account';
    end if;
    v_code := 'party:' || p_party_id::text || ':' || p_kind;
  elsif p_kind in (
    'system_issuance', 'system_escrow', 'system_retirement',
    'system_platform_loss', 'system_platform_debt', 'system_fees', 'system_taxes'
  ) then
    if p_party_id is not null then
      raise exception 'System ledger accounts cannot belong to a party';
    end if;
    v_code := p_kind;
  else
    raise exception 'Unsupported marketplace ledger account kind';
  end if;

  insert into private.marketplace_ledger_accounts (party_id, code, kind)
  values (p_party_id, v_code, p_kind)
  on conflict (code) do update set code = excluded.code
  returning id into v_account_id;

  return v_account_id;
end;
$$;

create or replace function private.marketplace_validate_existing_credit_journal(
  p_idempotency_key text,
  p_external_event_key text,
  p_party_id uuid,
  p_operation text,
  p_units bigint,
  p_terms_version text,
  p_grant_cohort_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_idempotency_journal_id uuid;
  v_event_journal_id uuid;
  v_existing private.marketplace_ledger_journals%rowtype;
begin
  select id into v_idempotency_journal_id
  from private.marketplace_ledger_journals
  where idempotency_key = p_idempotency_key;

  if p_external_event_key is not null then
    select id into v_event_journal_id
    from private.marketplace_ledger_journals
    where external_event_key = p_external_event_key;
  end if;

  if v_idempotency_journal_id is not null
     and v_event_journal_id is not null
     and v_idempotency_journal_id <> v_event_journal_id then
    raise exception 'Marketplace credit request conflicts with an existing idempotency or event key';
  end if;

  select * into v_existing
  from private.marketplace_ledger_journals
  where id = coalesce(v_idempotency_journal_id, v_event_journal_id);
  if not found then return null; end if;

  if v_existing.kind <> p_operation
     or v_existing.request_party_id <> p_party_id
     or v_existing.request_units <> p_units
     or v_existing.terms_version <> p_terms_version
     or (
       v_idempotency_journal_id is not null
       and v_existing.external_event_key is distinct from p_external_event_key
     )
     or (
       p_grant_cohort_id is not null
       and v_existing.grant_cohort_id is distinct from p_grant_cohort_id
     ) then
    raise exception 'Marketplace credit request conflicts with an existing idempotency or event key';
  end if;

  return v_existing.id;
end;
$$;

create or replace function private.marketplace_post_credit_operation(
  p_party_id uuid,
  p_operation text,
  p_units bigint,
  p_idempotency_key text,
  p_terms_version text,
  p_external_event_key text default null,
  p_grant_cohort_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_update_compatibility boolean default true,
  p_allow_migration_overdraft boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_journal_id uuid;
  v_member_account_id uuid;
  v_counter_account_id uuid;
  v_member_units bigint;
  v_counter_units bigint;
  v_member_kind text;
  v_counter_kind text;
  v_available_delta bigint := 0;
  v_reserved_delta bigint := 0;
begin
  if p_party_id is null then raise exception 'A marketplace party is required'; end if;
  if p_units <= 0 then raise exception 'Credit units must be positive'; end if;
  if char_length(trim(coalesce(p_idempotency_key, ''))) = 0 then
    raise exception 'An idempotency key is required';
  end if;
  if char_length(trim(coalesce(p_terms_version, ''))) = 0 then
    raise exception 'A terms version is required';
  end if;
  if jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object' then
    raise exception 'Ledger metadata must be an object';
  end if;

  v_journal_id := private.marketplace_validate_existing_credit_journal(
    p_idempotency_key, p_external_event_key, p_party_id, p_operation,
    p_units, p_terms_version, p_grant_cohort_id
  );
  if v_journal_id is not null then return v_journal_id; end if;

  if p_operation in ('grant_pending', 'grant_available') and p_grant_cohort_id is null then
    if p_external_event_key is null then
      raise exception 'A grant cohort or external event key is required for credit issuance';
    end if;
    insert into private.marketplace_grant_cohorts (
      party_id, source_event_key, terms_version, units, initial_state
    ) values (
      p_party_id,
      p_external_event_key,
      p_terms_version,
      p_units,
      case when p_operation = 'grant_pending' then 'pending' else 'available' end
    )
    on conflict (source_event_key) do nothing
    returning id into p_grant_cohort_id;

    if p_grant_cohort_id is null then
      select id into p_grant_cohort_id
      from private.marketplace_grant_cohorts
      where source_event_key = p_external_event_key;
      if p_grant_cohort_id is null then
        raise exception 'External grant event conflicts with its existing cohort';
      end if;
    end if;
  end if;

  if p_operation in ('grant_pending', 'grant_available') then
    if not exists (
      select 1
      from private.marketplace_grant_cohorts cohort
      where cohort.id = p_grant_cohort_id
        and cohort.party_id = p_party_id
        and cohort.terms_version = p_terms_version
        and cohort.units = p_units
        and cohort.initial_state = case
          when p_operation = 'grant_pending' then 'pending'
          else 'available'
        end
        and (
          p_external_event_key is null
          or cohort.source_event_key = p_external_event_key
        )
    ) then
      raise exception 'Grant cohort conflicts with the requested issuance';
    end if;

    if exists (
      select 1 from private.marketplace_ledger_journals
      where grant_cohort_id = p_grant_cohort_id
    ) then
      raise exception 'Grant cohort already issued';
    end if;
  elsif p_grant_cohort_id is not null then
    raise exception 'Grant cohorts are only valid for issuance operations';
  end if;

  case p_operation
    when 'grant_pending' then
      v_member_kind := 'member_pending'; v_counter_kind := 'system_issuance';
      v_member_units := p_units; v_counter_units := -p_units;
    when 'grant_available' then
      v_member_kind := 'member_available'; v_counter_kind := 'system_issuance';
      v_member_units := p_units; v_counter_units := -p_units;
      v_available_delta := p_units;
    when 'release_pending' then
      v_member_kind := 'member_pending'; v_counter_kind := 'member_available';
      v_member_units := -p_units; v_counter_units := p_units;
      v_available_delta := p_units;
    when 'reserve' then
      v_member_kind := 'member_available'; v_counter_kind := 'member_held';
      v_member_units := -p_units; v_counter_units := p_units;
      v_available_delta := -p_units; v_reserved_delta := p_units;
    when 'release' then
      v_member_kind := 'member_held'; v_counter_kind := 'member_available';
      v_member_units := -p_units; v_counter_units := p_units;
      v_available_delta := p_units; v_reserved_delta := -p_units;
    when 'settle_out' then
      v_member_kind := 'member_held'; v_counter_kind := 'system_escrow';
      v_member_units := -p_units; v_counter_units := p_units;
      v_reserved_delta := -p_units;
    when 'settle_in' then
      v_member_kind := 'member_available'; v_counter_kind := 'system_escrow';
      v_member_units := p_units; v_counter_units := -p_units;
      v_available_delta := p_units;
    when 'retire' then
      v_member_kind := 'member_available'; v_counter_kind := 'system_retirement';
      v_member_units := -p_units; v_counter_units := p_units;
      v_available_delta := -p_units;
    when 'loss_cover' then
      v_member_kind := 'member_available'; v_counter_kind := 'system_platform_loss';
      v_member_units := p_units; v_counter_units := -p_units;
      v_available_delta := p_units;
    else
      raise exception 'Unsupported marketplace credit operation';
  end case;

  v_member_account_id := private.marketplace_ledger_account(p_party_id, v_member_kind);
  v_counter_account_id := private.marketplace_ledger_account(
    case when v_counter_kind like 'member_%' then p_party_id else null end,
    v_counter_kind
  );

  perform 1
  from private.marketplace_ledger_accounts
  where id in (v_member_account_id, v_counter_account_id)
  order by id
  for update;

  -- A concurrent request may have committed while this call waited for the
  -- account locks. Re-check ownership before validating balances so retries
  -- return the original effect instead of observing the post-effect balance.
  v_journal_id := private.marketplace_validate_existing_credit_journal(
    p_idempotency_key, p_external_event_key, p_party_id, p_operation,
    p_units, p_terms_version, p_grant_cohort_id
  );
  if v_journal_id is not null then return v_journal_id; end if;

  if p_operation in ('grant_pending', 'grant_available') and exists (
    select 1 from private.marketplace_ledger_journals
    where grant_cohort_id = p_grant_cohort_id
  ) then
    raise exception 'Grant cohort already issued';
  end if;

  if not p_allow_migration_overdraft and v_member_kind like 'member_%' and (
    select balance + v_member_units
    from private.marketplace_ledger_accounts
    where id = v_member_account_id
  ) < 0 then
    raise exception 'Insufficient marketplace credit balance';
  end if;
  if not p_allow_migration_overdraft and v_counter_kind like 'member_%' and (
    select balance + v_counter_units
    from private.marketplace_ledger_accounts
    where id = v_counter_account_id
  ) < 0 then
    raise exception 'Insufficient marketplace credit balance';
  end if;

  insert into private.marketplace_ledger_journals (
    kind, request_party_id, request_units,
    idempotency_key, external_event_key, terms_version,
    grant_cohort_id, metadata
  ) values (
    p_operation, p_party_id, p_units,
    p_idempotency_key, p_external_event_key, p_terms_version,
    p_grant_cohort_id, coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_journal_id;

  insert into private.marketplace_ledger_postings (journal_id, account_id, units)
  values
    (v_journal_id, v_member_account_id, v_member_units),
    (v_journal_id, v_counter_account_id, v_counter_units);

  update private.marketplace_ledger_accounts
  set balance = balance + case
    when id = v_member_account_id then v_member_units
    else v_counter_units
  end
  where id in (v_member_account_id, v_counter_account_id);

  if p_update_compatibility and (v_available_delta <> 0 or v_reserved_delta <> 0) then
    insert into public.marketplace_credit_accounts (party_id, user_id)
    select party.id, party.user_id
    from private.marketplace_parties party
    where party.id = p_party_id
    on conflict (party_id) do nothing;

    update public.marketplace_credit_accounts
    set available_balance = available_balance + v_available_delta,
        reserved_balance = reserved_balance + v_reserved_delta,
        updated_at = now()
    where party_id = p_party_id
      and available_balance + v_available_delta >= 0
      and reserved_balance + v_reserved_delta >= 0;
    if not found then
      raise exception 'Compatibility credit balance is inconsistent';
    end if;
  end if;

  return v_journal_id;
exception
  when unique_violation then
    v_journal_id := private.marketplace_validate_existing_credit_journal(
      p_idempotency_key, p_external_event_key, p_party_id, p_operation,
      p_units, p_terms_version, p_grant_cohort_id
    );
    if v_journal_id is null then raise; end if;
    return v_journal_id;
end;
$$;

create or replace function private.marketplace_reverse_credit_journal(
  p_journal_id uuid,
  p_idempotency_key text,
  p_reason_version text default 'v1'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reversal_id uuid;
  v_account record;
  v_party_id uuid;
  v_available_delta bigint;
  v_reserved_delta bigint;
begin
  select id into v_reversal_id
  from private.marketplace_ledger_journals
  where idempotency_key = p_idempotency_key;
  if found then
    if exists (
      select 1 from private.marketplace_ledger_journals
      where id = v_reversal_id
        and kind = 'reversal'
        and reversal_of = p_journal_id
    ) then
      return v_reversal_id;
    end if;
    raise exception 'Marketplace reversal request conflicts with an existing idempotency key';
  end if;

  if exists (
    select 1 from private.marketplace_ledger_journals where reversal_of = p_journal_id
  ) then
    raise exception 'Marketplace journal already reversed';
  end if;

  if not exists (
    select 1 from private.marketplace_ledger_journals where id = p_journal_id
  ) then
    raise exception 'Marketplace journal not found';
  end if;

  perform 1
  from private.marketplace_ledger_accounts account
  join private.marketplace_ledger_postings posting on posting.account_id = account.id
  where posting.journal_id = p_journal_id
  order by account.id
  for update of account;

  -- Account locks serialize reversals of the same economic effect. Re-check
  -- both keys after waiting so identical retries resolve to the one reversal.
  select id into v_reversal_id
  from private.marketplace_ledger_journals
  where idempotency_key = p_idempotency_key;
  if found then
    if exists (
      select 1 from private.marketplace_ledger_journals
      where id = v_reversal_id
        and kind = 'reversal'
        and reversal_of = p_journal_id
    ) then
      return v_reversal_id;
    end if;
    raise exception 'Marketplace reversal request conflicts with an existing idempotency key';
  end if;

  select id into v_reversal_id
  from private.marketplace_ledger_journals
  where reversal_of = p_journal_id;
  if found then
    raise exception 'Marketplace journal already reversed';
  end if;

  for v_account in
    select account.id, account.kind, account.balance, -posting.units as reversal_units
    from private.marketplace_ledger_postings posting
    join private.marketplace_ledger_accounts account on account.id = posting.account_id
    where posting.journal_id = p_journal_id
  loop
    if v_account.kind like 'member_%'
       and v_account.balance + v_account.reversal_units < 0 then
      raise exception 'Reversal would overdraw a member credit account';
    end if;
  end loop;

  insert into private.marketplace_ledger_journals (
    kind, request_party_id, request_units, idempotency_key,
    terms_version, reason_version, reversal_of, metadata
  )
  select 'reversal', request_party_id, request_units, p_idempotency_key,
         terms_version, p_reason_version,
         id, jsonb_build_object('reverses', id)
  from private.marketplace_ledger_journals
  where id = p_journal_id
  returning id into v_reversal_id;

  insert into private.marketplace_ledger_postings (journal_id, account_id, units)
  select v_reversal_id, account_id, -units
  from private.marketplace_ledger_postings
  where journal_id = p_journal_id;

  update private.marketplace_ledger_accounts account
  set balance = account.balance + reversal.delta
  from (
    select account_id, -sum(units) as delta
    from private.marketplace_ledger_postings
    where journal_id = p_journal_id
    group by account_id
  ) reversal
  where account.id = reversal.account_id;

  select
    min(account.party_id::text)::uuid,
    coalesce(sum(-posting.units) filter (where account.kind = 'member_available'), 0),
    coalesce(sum(-posting.units) filter (where account.kind = 'member_held'), 0)
  into v_party_id, v_available_delta, v_reserved_delta
  from private.marketplace_ledger_postings posting
  join private.marketplace_ledger_accounts account on account.id = posting.account_id
  where posting.journal_id = p_journal_id
    and account.party_id is not null;

  if v_party_id is not null then
    update public.marketplace_credit_accounts
    set available_balance = available_balance + v_available_delta,
        reserved_balance = reserved_balance + v_reserved_delta,
        updated_at = now()
    where party_id = v_party_id
      and available_balance + v_available_delta >= 0
      and reserved_balance + v_reserved_delta >= 0;
    if not found then
      raise exception 'Compatibility credit balance is inconsistent';
    end if;
  end if;

  return v_reversal_id;
exception
  when unique_violation then
    select id into v_reversal_id
    from private.marketplace_ledger_journals
    where idempotency_key = p_idempotency_key
      and kind = 'reversal'
      and reversal_of = p_journal_id;
    if v_reversal_id is null then raise; end if;
    return v_reversal_id;
end;
$$;

create or replace function private.marketplace_post_opening_adjustment(
  p_party_id uuid,
  p_member_kind text,
  p_delta bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_journal_id uuid;
  v_member_account_id uuid;
  v_platform_account_id uuid;
begin
  if p_delta = 0 then return null; end if;
  if p_member_kind not in ('member_available', 'member_held') then
    raise exception 'Unsupported opening balance account';
  end if;

  v_member_account_id := private.marketplace_ledger_account(p_party_id, p_member_kind);
  v_platform_account_id := private.marketplace_ledger_account(null, 'system_platform_loss');

  perform 1 from private.marketplace_ledger_accounts
  where id in (v_member_account_id, v_platform_account_id)
  order by id for update;

  insert into private.marketplace_ledger_journals (
    kind, request_party_id, request_units, idempotency_key, terms_version, metadata
  ) values (
    'migration_adjustment', p_party_id, abs(p_delta),
    'migration:opening:' || p_party_id::text || ':' || p_member_kind,
    'legacy-v1',
    jsonb_build_object('compatibility_backfill', true)
  )
  on conflict (idempotency_key) do nothing
  returning id into v_journal_id;

  if v_journal_id is null then
    select id into v_journal_id from private.marketplace_ledger_journals
    where idempotency_key = 'migration:opening:' || p_party_id::text || ':' || p_member_kind;
    return v_journal_id;
  end if;

  insert into private.marketplace_ledger_postings (journal_id, account_id, units)
  values
    (v_journal_id, v_member_account_id, p_delta),
    (v_journal_id, v_platform_account_id, -p_delta);

  update private.marketplace_ledger_accounts
  set balance = balance + case when id = v_member_account_id then p_delta else -p_delta end
  where id in (v_member_account_id, v_platform_account_id);

  return v_journal_id;
end;
$$;

create or replace function private.marketplace_post_legacy_adjustment(
  p_entry public.marketplace_credit_ledger
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_journal_id uuid;
  v_available_account_id uuid;
  v_held_account_id uuid;
  v_platform_account_id uuid;
  v_units bigint := abs(p_entry.delta_available::bigint)
    + abs(p_entry.delta_reserved::bigint);
  v_counter_units bigint := -(
    p_entry.delta_available::bigint + p_entry.delta_reserved::bigint
  );
begin
  if v_units <= 0 then
    raise exception 'Legacy marketplace credit entry has invalid units';
  end if;

  v_journal_id := private.marketplace_validate_existing_credit_journal(
    'legacy:' || p_entry.idempotency_key,
    null,
    p_entry.party_id,
    'legacy_adjustment',
    v_units,
    'legacy-v1',
    null
  );
  if v_journal_id is not null then return v_journal_id; end if;

  v_available_account_id := private.marketplace_ledger_account(
    p_entry.party_id, 'member_available'
  );
  v_held_account_id := private.marketplace_ledger_account(
    p_entry.party_id, 'member_held'
  );
  v_platform_account_id := private.marketplace_ledger_account(
    null, 'system_platform_loss'
  );

  perform 1
  from private.marketplace_ledger_accounts
  where id in (v_available_account_id, v_held_account_id, v_platform_account_id)
  order by id
  for update;

  v_journal_id := private.marketplace_validate_existing_credit_journal(
    'legacy:' || p_entry.idempotency_key,
    null,
    p_entry.party_id,
    'legacy_adjustment',
    v_units,
    'legacy-v1',
    null
  );
  if v_journal_id is not null then return v_journal_id; end if;

  insert into private.marketplace_ledger_journals (
    kind, request_party_id, request_units, idempotency_key, terms_version, metadata
  ) values (
    'legacy_adjustment',
    p_entry.party_id,
    v_units,
    'legacy:' || p_entry.idempotency_key,
    'legacy-v1',
    jsonb_build_object(
      'legacy_ledger_id', p_entry.id,
      'offer_id', p_entry.offer_id,
      'transaction_id', p_entry.transaction_id
    )
  )
  returning id into v_journal_id;

  insert into private.marketplace_ledger_postings (journal_id, account_id, units)
  select v_journal_id, account_id, units
  from (values
    (v_available_account_id, p_entry.delta_available),
    (v_held_account_id, p_entry.delta_reserved),
    (v_platform_account_id, v_counter_units)
  ) posting(account_id, units)
  where units <> 0;

  update private.marketplace_ledger_accounts account
  set balance = account.balance + delta.units
  from (values
    (v_available_account_id, p_entry.delta_available),
    (v_held_account_id, p_entry.delta_reserved),
    (v_platform_account_id, v_counter_units)
  ) delta(account_id, units)
  where account.id = delta.account_id
    and delta.units <> 0;

  return v_journal_id;
end;
$$;

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
    v_operation := 'reserve'; v_units := p_entry.delta_reserved;
  elsif p_entry.kind in ('offer_release', 'cancellation_release') then
    v_operation := 'release'; v_units := p_entry.delta_available;
  elsif p_entry.kind = 'transfer_out' then
    v_operation := 'settle_out'; v_units := -p_entry.delta_reserved;
  elsif p_entry.kind = 'transfer_in' then
    v_operation := 'settle_in'; v_units := p_entry.delta_available;
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

create or replace function private.marketplace_mirror_legacy_credit_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.marketplace_mirror_legacy_credit_entry_from_row(new);
  return new;
end;
$$;

-- Create every system account before migrating legacy history.
select private.marketplace_ledger_account(null, kind)
from unnest(array[
  'system_issuance', 'system_escrow', 'system_retirement',
  'system_platform_loss', 'system_platform_debt', 'system_fees', 'system_taxes'
]) as kind;

-- Create the member account set even for members whose development balance has
-- no historical ledger rows, then replay all available legacy evidence.
select private.marketplace_ledger_account(account.party_id, kind)
from public.marketplace_credit_accounts account
cross join unnest(array['member_pending', 'member_available', 'member_held']) as kind;

do $$
declare
  v_entry public.marketplace_credit_ledger%rowtype;
  v_account public.marketplace_credit_accounts%rowtype;
  v_available bigint;
  v_held bigint;
begin
  for v_entry in
    select * from public.marketplace_credit_ledger order by created_at, id
  loop
    perform private.marketplace_mirror_legacy_credit_entry_from_row(v_entry);
  end loop;

  for v_account in select * from public.marketplace_credit_accounts
  loop
    select balance into v_available
    from private.marketplace_ledger_accounts
    where party_id = v_account.party_id and kind = 'member_available';
    select balance into v_held
    from private.marketplace_ledger_accounts
    where party_id = v_account.party_id and kind = 'member_held';

    perform private.marketplace_post_opening_adjustment(
      v_account.party_id, 'member_available', v_account.available_balance - coalesce(v_available, 0)
    );
    perform private.marketplace_post_opening_adjustment(
      v_account.party_id, 'member_held', v_account.reserved_balance - coalesce(v_held, 0)
    );
  end loop;
end;
$$;

create trigger marketplace_credit_ledger_double_entry
after insert on public.marketplace_credit_ledger
for each row execute function private.marketplace_mirror_legacy_credit_entry();

create or replace function public.marketplace_my_credit_balance()
returns table (pending_credits bigint, available_credits bigint, held_credits bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(sum(account.balance) filter (where account.kind = 'member_pending'), 0)::bigint,
    coalesce(sum(account.balance) filter (where account.kind = 'member_available'), 0)::bigint,
    coalesce(sum(account.balance) filter (where account.kind = 'member_held'), 0)::bigint
  from private.marketplace_parties party
  left join private.marketplace_ledger_accounts account on account.party_id = party.id
  where party.user_id = (select auth.uid());
$$;

create or replace function public.marketplace_my_credit_history(p_limit integer default 50)
returns table (
  journal_id uuid,
  kind text,
  available_delta bigint,
  pending_delta bigint,
  held_delta bigint,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_limit < 1 or p_limit > 100 then raise exception 'History limit must be between 1 and 100'; end if;

  return query
  select
    journal.id,
    journal.kind,
    coalesce(sum(posting.units) filter (where account.kind = 'member_available'), 0)::bigint,
    coalesce(sum(posting.units) filter (where account.kind = 'member_pending'), 0)::bigint,
    coalesce(sum(posting.units) filter (where account.kind = 'member_held'), 0)::bigint,
    journal.created_at
  from private.marketplace_parties party
  join private.marketplace_ledger_accounts account on account.party_id = party.id
  join private.marketplace_ledger_postings posting on posting.account_id = account.id
  join private.marketplace_ledger_journals journal on journal.id = posting.journal_id
  where party.user_id = (select auth.uid())
  group by journal.id, journal.kind, journal.created_at
  order by journal.created_at desc, journal.id desc
  limit p_limit;
end;
$$;

create or replace function public.marketplace_reconcile_credit_ledger()
returns table (
  party_id uuid,
  legacy_available bigint,
  cached_available bigint,
  posting_available bigint,
  legacy_reserved bigint,
  cached_held bigint,
  posting_held bigint,
  cached_pending bigint,
  posting_pending bigint,
  balanced boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with cached as (
    select
      account.party_id,
      coalesce(sum(account.balance) filter (
        where account.kind = 'member_available'
      ), 0)::bigint as available,
      coalesce(sum(account.balance) filter (
        where account.kind = 'member_held'
      ), 0)::bigint as held,
      coalesce(sum(account.balance) filter (
        where account.kind = 'member_pending'
      ), 0)::bigint as pending
    from private.marketplace_ledger_accounts account
    where account.party_id is not null
    group by account.party_id
  ), posting as (
    select
      account.party_id,
      coalesce(sum(entry.units) filter (
        where account.kind = 'member_available'
      ), 0)::bigint as available,
      coalesce(sum(entry.units) filter (
        where account.kind = 'member_held'
      ), 0)::bigint as held,
      coalesce(sum(entry.units) filter (
        where account.kind = 'member_pending'
      ), 0)::bigint as pending
    from private.marketplace_ledger_accounts account
    left join private.marketplace_ledger_postings entry on entry.account_id = account.id
    where account.party_id is not null
    group by account.party_id
  )
  select
    compatibility.party_id,
    compatibility.available_balance::bigint,
    coalesce(cached.available, 0)::bigint,
    coalesce(posting.available, 0)::bigint as posting_available,
    compatibility.reserved_balance::bigint,
    coalesce(cached.held, 0)::bigint,
    coalesce(posting.held, 0)::bigint as posting_held,
    coalesce(cached.pending, 0)::bigint,
    coalesce(posting.pending, 0)::bigint,
    compatibility.available_balance = coalesce(cached.available, 0)
      and compatibility.available_balance = coalesce(posting.available, 0)
      and compatibility.reserved_balance = coalesce(cached.held, 0)
      and compatibility.reserved_balance = coalesce(posting.held, 0)
      and coalesce(cached.pending, 0) = coalesce(posting.pending, 0)
  from public.marketplace_credit_accounts compatibility
  left join cached on cached.party_id = compatibility.party_id
  left join posting on posting.party_id = compatibility.party_id
  order by compatibility.party_id;
$$;

revoke all on function private.marketplace_reject_ledger_mutation() from public, anon, authenticated;
revoke all on function private.marketplace_assert_balanced_journal() from public, anon, authenticated;
revoke all on function private.marketplace_ledger_account(uuid, text) from public, anon, authenticated;
revoke all on function private.marketplace_validate_existing_credit_journal(text, text, uuid, text, bigint, text, uuid) from public, anon, authenticated;
revoke all on function private.marketplace_post_credit_operation(uuid, text, bigint, text, text, text, uuid, jsonb, boolean, boolean) from public, anon, authenticated;
revoke all on function private.marketplace_reverse_credit_journal(uuid, text, text) from public, anon, authenticated;
revoke all on function private.marketplace_post_opening_adjustment(uuid, text, bigint) from public, anon, authenticated;
revoke all on function private.marketplace_post_legacy_adjustment(public.marketplace_credit_ledger) from public, anon, authenticated;
revoke all on function private.marketplace_mirror_legacy_credit_entry_from_row(public.marketplace_credit_ledger) from public, anon, authenticated;
revoke all on function private.marketplace_mirror_legacy_credit_entry() from public, anon, authenticated;
revoke all on function public.marketplace_my_credit_balance() from public, anon;
revoke all on function public.marketplace_my_credit_history(integer) from public, anon;
revoke all on function public.marketplace_reconcile_credit_ledger() from public, anon, authenticated;

grant usage on schema private to service_role;
grant execute on function private.marketplace_post_credit_operation(uuid, text, bigint, text, text, text, uuid, jsonb, boolean, boolean) to service_role;
grant execute on function private.marketplace_reverse_credit_journal(uuid, text, text) to service_role;
grant execute on function public.marketplace_my_credit_balance() to authenticated;
grant execute on function public.marketplace_my_credit_history(integer) to authenticated;
grant execute on function public.marketplace_reconcile_credit_ledger() to service_role;
