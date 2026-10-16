-- Establish the C07 server-authoritative offer/transaction contract. Expiry
-- execution remains C08; this migration records deadlines and terminal states
-- without running a scheduler. Production values remain configurable.

alter table public.marketplace_config
  add column grants_enabled boolean not null default true,
  add column offers_enabled boolean not null default true,
  add column acceptance_enabled boolean not null default true,
  add column settlement_enabled boolean not null default true,
  add column offer_ttl interval not null default interval '7 days'
    check (offer_ttl > interval '0' and offer_ttl <= interval '30 days'),
  add column handoff_ttl interval not null default interval '7 days'
    check (handoff_ttl > interval '0' and handoff_ttl <= interval '30 days'),
  add column terms_version text not null default 'marketplace-pilot-v1'
    check (char_length(trim(terms_version)) between 1 and 80);

alter table public.marketplace_offers
  add column expires_at timestamptz,
  add column accepted_at timestamptz;

update public.marketplace_offers offer_record
set expires_at = offer_record.created_at + config.offer_ttl,
    accepted_at = case
      when offer_record.status = 'accepted' then offer_record.updated_at
      else null
    end
from public.marketplace_config config
where config.id = true;

alter table public.marketplace_offers
  alter column expires_at set not null,
  drop constraint marketplace_offers_status_check,
  add constraint marketplace_offers_status_check
    check (status in (
      'pending', 'accepted', 'rejected', 'withdrawn', 'superseded', 'expired'
    ));

alter table public.marketplace_transactions
  add column accepted_at timestamptz,
  add column handoff_deadline timestamptz;

update public.marketplace_transactions transaction_record
set accepted_at = transaction_record.created_at,
    handoff_deadline = transaction_record.created_at + config.handoff_ttl
from public.marketplace_config config
where config.id = true;

alter table public.marketplace_transactions
  alter column accepted_at set not null,
  alter column handoff_deadline set not null,
  drop constraint marketplace_transactions_status_check,
  add constraint marketplace_transactions_status_check
    check (status in (
      'awaiting_handoff', 'completed', 'cancelled', 'disputed', 'expired'
    )),
  add constraint marketplace_transactions_handoff_deadline_check
    check (handoff_deadline > accepted_at);

create table private.marketplace_transaction_terms (
  transaction_id uuid primary key
    references public.marketplace_transactions(id) on delete restrict,
  offer_id uuid not null,
  listing_id uuid not null,
  swap_listing_id uuid,
  buyer_party_id uuid not null
    references private.marketplace_parties(id) on delete restrict,
  seller_party_id uuid not null
    references private.marketplace_parties(id) on delete restrict,
  mode text not null check (mode in ('credits', 'swap', 'giveaway')),
  credit_amount integer,
  target_accepts_credits boolean not null,
  target_accepts_swap boolean not null,
  target_is_giveaway boolean not null,
  target_credit_price integer,
  offer_created_at timestamptz not null,
  offer_expires_at timestamptz not null,
  accepted_at timestamptz not null,
  handoff_deadline timestamptz not null,
  terms_version text not null,
  created_at timestamptz not null default now(),
  check (buyer_party_id <> seller_party_id),
  check (handoff_deadline > accepted_at),
  check (
    (mode = 'credits' and credit_amount is not null and swap_listing_id is null)
    or (mode = 'swap' and credit_amount is null and swap_listing_id is not null)
    or (mode = 'giveaway' and credit_amount is null and swap_listing_id is null)
  )
);

revoke all on private.marketplace_transaction_terms from public, anon, authenticated;

insert into private.marketplace_transaction_terms (
  transaction_id, offer_id, listing_id, swap_listing_id,
  buyer_party_id, seller_party_id, mode, credit_amount,
  target_accepts_credits, target_accepts_swap, target_is_giveaway,
  target_credit_price, offer_created_at, offer_expires_at,
  accepted_at, handoff_deadline, terms_version
)
select
  transaction_record.id,
  transaction_record.offer_id,
  transaction_record.listing_id,
  transaction_record.swap_listing_id,
  transaction_record.buyer_party_id,
  transaction_record.seller_party_id,
  transaction_record.mode,
  transaction_record.credit_amount,
  listing.accepts_credits,
  listing.accepts_swap,
  listing.is_giveaway,
  listing.credit_price,
  offer_record.created_at,
  offer_record.expires_at,
  transaction_record.accepted_at,
  transaction_record.handoff_deadline,
  config.terms_version
from public.marketplace_transactions transaction_record
join public.marketplace_offers offer_record
  on offer_record.id = transaction_record.offer_id
join public.marketplace_listings listing
  on listing.id = transaction_record.listing_id
join public.marketplace_config config on config.id = true;

create or replace function private.marketplace_feature_enabled(p_feature text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select config.transactions_enabled and case p_feature
    when 'grants' then config.grants_enabled
    when 'offers' then config.offers_enabled
    when 'acceptance' then config.acceptance_enabled
    when 'settlement' then config.settlement_enabled
    when 'transactions' then true
    else false
  end
  from public.marketplace_config config
  where config.id = true;
$$;

create or replace function private.marketplace_require_feature(p_feature text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.marketplace_feature_enabled(p_feature) then return; end if;

  if not coalesce((
    select config.transactions_enabled
    from public.marketplace_config config where config.id = true
  ), false) then
    raise exception 'Marketplace transactions are paused';
  end if;

  case p_feature
    when 'grants' then raise exception 'Marketplace grants are paused';
    when 'offers' then raise exception 'Marketplace offer creation is paused';
    when 'acceptance' then raise exception 'Marketplace acceptance is paused';
    when 'settlement' then raise exception 'Marketplace settlement is paused';
    else raise exception 'Marketplace feature is paused';
  end case;
end;
$$;

create or replace function private.marketplace_guard_listing_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.marketplace_require_feature('transactions');
  elsif old.status = 'active' and new.status = 'active' and (
    old.accepts_credits is distinct from new.accepts_credits
    or old.accepts_swap is distinct from new.accepts_swap
    or old.is_giveaway is distinct from new.is_giveaway
    or old.credit_price is distinct from new.credit_price
    or old.pickup_area is distinct from new.pickup_area
  ) then
    perform private.marketplace_require_feature('transactions');
  end if;
  return new;
end;
$$;

create trigger marketplace_listing_state_guard
before insert or update on public.marketplace_listings
for each row execute function private.marketplace_guard_listing_write();

create or replace function private.marketplace_guard_offer_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer_ttl interval;
begin
  if tg_op = 'INSERT' then
    perform private.marketplace_require_feature('offers');
    if new.status <> 'pending' then
      raise exception 'New marketplace offers must be pending';
    end if;
    select offer_ttl into v_offer_ttl
    from public.marketplace_config where id = true;
    new.expires_at := coalesce(new.expires_at, new.created_at + v_offer_ttl);
    return new;
  end if;

  if old.listing_id is distinct from new.listing_id
    or old.buyer_party_id is distinct from new.buyer_party_id
    or old.seller_party_id is distinct from new.seller_party_id
    or old.mode is distinct from new.mode
    or old.credit_amount is distinct from new.credit_amount
    or old.swap_listing_id is distinct from new.swap_listing_id
    or old.expires_at is distinct from new.expires_at then
    raise exception 'Marketplace offer terms are immutable';
  end if;

  if old.status is distinct from new.status then
    if old.status <> 'pending'
      or new.status not in (
        'accepted', 'rejected', 'withdrawn', 'superseded', 'expired'
      ) then
      raise exception 'Invalid marketplace offer transition';
    end if;
    if new.status = 'accepted' then
      perform private.marketplace_require_feature('acceptance');
      new.accepted_at := coalesce(new.accepted_at, now());
    elsif new.accepted_at is not null then
      raise exception 'Only accepted offers have an acceptance time';
    end if;
  end if;

  return new;
end;
$$;

create trigger marketplace_offer_state_guard
before insert or update on public.marketplace_offers
for each row execute function private.marketplace_guard_offer_state();

create or replace function private.marketplace_guard_transaction_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_handoff_ttl interval;
begin
  if tg_op = 'INSERT' then
    perform private.marketplace_require_feature('acceptance');
    if new.status <> 'awaiting_handoff' then
      raise exception 'New marketplace transactions must await handoff';
    end if;
    select handoff_ttl into v_handoff_ttl
    from public.marketplace_config where id = true;
    new.accepted_at := coalesce(new.accepted_at, new.created_at);
    new.handoff_deadline := coalesce(
      new.handoff_deadline, new.accepted_at + v_handoff_ttl
    );
    return new;
  end if;

  if old.offer_id is distinct from new.offer_id
    or old.listing_id is distinct from new.listing_id
    or old.buyer_party_id is distinct from new.buyer_party_id
    or old.seller_party_id is distinct from new.seller_party_id
    or old.mode is distinct from new.mode
    or old.credit_amount is distinct from new.credit_amount
    or old.swap_listing_id is distinct from new.swap_listing_id
    or old.accepted_at is distinct from new.accepted_at
    or old.handoff_deadline is distinct from new.handoff_deadline then
    raise exception 'Marketplace transaction terms are immutable';
  end if;

  if old.status is distinct from new.status then
    if not (
      (old.status = 'awaiting_handoff' and new.status in (
        'completed', 'cancelled', 'disputed', 'expired'
      ))
      or (old.status = 'disputed' and new.status in ('completed', 'cancelled'))
    ) then
      raise exception 'Invalid marketplace transaction transition';
    end if;
  end if;

  if (
    old.buyer_confirmed_at is distinct from new.buyer_confirmed_at
    or old.seller_confirmed_at is distinct from new.seller_confirmed_at
    or new.status = 'completed'
  ) then
    perform private.marketplace_require_feature('settlement');
  end if;

  if new.status = 'completed' and (
    new.buyer_confirmed_at is null or new.seller_confirmed_at is null
  ) then
    raise exception 'Both participants must confirm marketplace handoff';
  end if;

  return new;
end;
$$;

create trigger marketplace_transaction_state_guard
before insert or update on public.marketplace_transactions
for each row execute function private.marketplace_guard_transaction_state();

create or replace function private.marketplace_guard_credit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind in ('membership_grant', 'renewal_grant') then
    perform private.marketplace_require_feature('grants');
  elsif new.kind = 'offer_reserve' then
    perform private.marketplace_require_feature('offers');
  elsif new.kind in ('transfer_out', 'transfer_in') then
    perform private.marketplace_require_feature('settlement');
  end if;
  return new;
end;
$$;

create trigger marketplace_credit_event_state_guard
before insert on public.marketplace_credit_ledger
for each row execute function private.marketplace_guard_credit_event();

create or replace function private.marketplace_capture_transaction_terms()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.marketplace_transaction_terms (
    transaction_id, offer_id, listing_id, swap_listing_id,
    buyer_party_id, seller_party_id, mode, credit_amount,
    target_accepts_credits, target_accepts_swap, target_is_giveaway,
    target_credit_price, offer_created_at, offer_expires_at,
    accepted_at, handoff_deadline, terms_version
  )
  select
    new.id, new.offer_id, new.listing_id, new.swap_listing_id,
    new.buyer_party_id, new.seller_party_id, new.mode, new.credit_amount,
    listing.accepts_credits, listing.accepts_swap, listing.is_giveaway,
    listing.credit_price, offer_record.created_at, offer_record.expires_at,
    new.accepted_at, new.handoff_deadline, config.terms_version
  from public.marketplace_offers offer_record
  join public.marketplace_listings listing on listing.id = new.listing_id
  join public.marketplace_config config on config.id = true
  where offer_record.id = new.offer_id;

  if not found then
    raise exception 'Marketplace transaction terms could not be captured';
  end if;
  return new;
end;
$$;

create trigger marketplace_capture_transaction_terms
after insert on public.marketplace_transactions
for each row execute function private.marketplace_capture_transaction_terms();

create or replace function private.marketplace_reject_immutable_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Marketplace transaction terms are immutable';
end;
$$;

create trigger marketplace_transaction_terms_immutable
before update or delete on private.marketplace_transaction_terms
for each row execute function private.marketplace_reject_immutable_change();

create trigger account_deletion_write_barrier
before insert or update on private.marketplace_transaction_terms
for each row execute function private.account_deletion_reject_write(
  'party:buyer_party_id', 'party:seller_party_id'
);

create or replace function private.marketplace_release_offer(
  p_offer_id uuid,
  p_new_status text,
  p_ledger_kind text default 'offer_release'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.marketplace_offers%rowtype;
  v_ledger_id uuid;
begin
  if p_new_status not in ('rejected', 'withdrawn', 'superseded', 'expired') then
    raise exception 'Invalid offer release status';
  end if;
  if p_ledger_kind not in ('offer_release', 'cancellation_release') then
    raise exception 'Invalid offer release ledger kind';
  end if;

  select * into v_offer
  from public.marketplace_offers
  where id = p_offer_id
  for update;

  if not found or v_offer.status <> 'pending' then return; end if;

  if v_offer.mode = 'credits' then
    insert into public.marketplace_credit_ledger (
      user_id, party_id, offer_id, kind,
      delta_available, delta_reserved, idempotency_key, description
    ) values (
      v_offer.buyer_id, v_offer.buyer_party_id, v_offer.id, p_ledger_kind,
      v_offer.credit_amount, -v_offer.credit_amount,
      p_ledger_kind || ':' || v_offer.id::text,
      'Credits released from an offer'
    )
    on conflict (idempotency_key) do nothing
    returning id into v_ledger_id;

    if v_ledger_id is not null then
      update public.marketplace_credit_accounts
      set available_balance = available_balance + v_offer.credit_amount,
          reserved_balance = reserved_balance - v_offer.credit_amount,
          updated_at = now()
      where party_id = v_offer.buyer_party_id
        and reserved_balance >= v_offer.credit_amount;
      if not found then
        raise exception 'Reserved credit balance is inconsistent';
      end if;
    end if;
  end if;

  update public.marketplace_offers
  set status = p_new_status, updated_at = now()
  where id = v_offer.id;
end;
$$;

create or replace function public.marketplace_respond_to_offer(
  p_offer_id uuid,
  p_accept boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_offer public.marketplace_offers%rowtype;
  v_transaction_id uuid;
  v_competing record;
begin
  select * into v_offer
  from public.marketplace_offers
  where id = p_offer_id;

  if not found or v_offer.seller_id <> v_user_id then
    raise exception 'Pending offer not found';
  end if;

  if p_accept and v_offer.status = 'accepted' then
    select id into v_transaction_id
    from public.marketplace_transactions where offer_id = v_offer.id;
    if v_transaction_id is null then
      raise exception 'Accepted offer is missing its transaction';
    end if;
    return v_transaction_id;
  end if;
  if not p_accept then
    if v_offer.status = 'rejected' then return null; end if;
    if v_offer.status <> 'pending' then raise exception 'Pending offer not found'; end if;
    perform private.marketplace_release_offer(v_offer.id, 'rejected');
    if (select status from public.marketplace_offers where id = v_offer.id) = 'rejected' then
      return null;
    end if;
    raise exception 'Pending offer not found';
  end if;

  if v_offer.status <> 'pending' then
    if not exists (
      select 1 from public.marketplace_listings
      where id = v_offer.listing_id and status = 'active'
    ) then
      raise exception 'Listing is no longer available';
    end if;
    raise exception 'Pending offer not found';
  end if;

  perform private.marketplace_require_feature('acceptance');
  if v_offer.expires_at <= now() then raise exception 'Offer has expired'; end if;
  if not private.marketplace_has_active_membership(v_user_id)
    or not private.marketplace_has_active_membership(v_offer.buyer_id) then
    raise exception 'Both members need an active membership';
  end if;

  -- All competing acceptances lock the shared listing set first and in the
  -- same order. Locking individual offers first can deadlock when the winner
  -- supersedes a losing offer whose session is waiting on the listing.
  perform 1 from public.marketplace_listings
  where id = v_offer.listing_id or id = v_offer.swap_listing_id
  order by id
  for update;

  select * into v_offer
  from public.marketplace_offers
  where id = p_offer_id
  for update;
  if not found or v_offer.seller_id <> v_user_id then
    raise exception 'Pending offer not found';
  end if;
  if v_offer.status = 'accepted' then
    select id into v_transaction_id
    from public.marketplace_transactions where offer_id = v_offer.id;
    if v_transaction_id is null then
      raise exception 'Accepted offer is missing its transaction';
    end if;
    return v_transaction_id;
  end if;
  if v_offer.status <> 'pending' then
    if not exists (
      select 1 from public.marketplace_listings
      where id = v_offer.listing_id and status = 'active'
    ) then
      raise exception 'Listing is no longer available';
    end if;
    raise exception 'Pending offer not found';
  end if;

  if not exists (
    select 1 from public.marketplace_listings
    where id = v_offer.listing_id and status = 'active'
  ) then
    raise exception 'Listing is no longer available';
  end if;

  if v_offer.mode = 'swap' then
    if not exists (
      select 1 from public.marketplace_listings
    where id = v_offer.swap_listing_id
        and seller_id = v_offer.buyer_id
        and status = 'active'
    ) then
      raise exception 'Swap listing is no longer available';
    end if;
  end if;

  insert into public.marketplace_transactions (
    offer_id, listing_id, seller_id, buyer_id, mode,
    credit_amount, swap_listing_id
  ) values (
    v_offer.id, v_offer.listing_id, v_offer.seller_id, v_offer.buyer_id,
    v_offer.mode, v_offer.credit_amount, v_offer.swap_listing_id
  ) returning id into v_transaction_id;

  update public.marketplace_offers
  set status = 'accepted', updated_at = now()
  where id = v_offer.id;
  update public.marketplace_listings
  set status = 'reserved', updated_at = now()
  where id = v_offer.listing_id;
  if v_offer.swap_listing_id is not null then
    update public.marketplace_listings
    set status = 'reserved', updated_at = now()
    where id = v_offer.swap_listing_id;
  end if;

  for v_competing in
    select id from public.marketplace_offers
    where status = 'pending' and id <> v_offer.id and (
      listing_id = v_offer.listing_id
      or swap_listing_id = v_offer.listing_id
      or listing_id = v_offer.swap_listing_id
      or swap_listing_id = v_offer.swap_listing_id
    )
    for update
  loop
    perform private.marketplace_release_offer(v_competing.id, 'superseded');
  end loop;
  return v_transaction_id;
end;
$$;

create or replace function public.marketplace_cancel_transaction(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_tx public.marketplace_transactions%rowtype;
  v_ledger_id uuid;
begin
  select * into v_tx
  from public.marketplace_transactions
  where id = p_transaction_id
  for update;
  if not found or v_user_id not in (v_tx.buyer_id, v_tx.seller_id) then
    raise exception 'Transaction not found';
  end if;
  if v_tx.status = 'cancelled' then return; end if;
  if v_tx.status <> 'awaiting_handoff' then
    raise exception 'Only an open transaction can be cancelled';
  end if;

  if v_tx.mode = 'credits' then
    insert into public.marketplace_credit_ledger (
      user_id, party_id, offer_id, transaction_id, kind,
      delta_available, delta_reserved, idempotency_key, description
    ) values (
      v_tx.buyer_id, v_tx.buyer_party_id, v_tx.offer_id, v_tx.id,
      'cancellation_release', v_tx.credit_amount, -v_tx.credit_amount,
      'transaction:' || v_tx.id::text || ':cancel',
      'Credits released after cancellation'
    )
    on conflict (idempotency_key) do nothing
    returning id into v_ledger_id;

    if v_ledger_id is not null then
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
  end if;

  update public.marketplace_transactions
  set status = 'cancelled', cancelled_at = now(), updated_at = now()
  where id = v_tx.id;
  update public.marketplace_listings
  set status = 'active', updated_at = now()
  where id = v_tx.listing_id or id = v_tx.swap_listing_id;
end;
$$;

revoke all on function private.marketplace_feature_enabled(text) from public, anon, authenticated;
revoke all on function private.marketplace_require_feature(text) from public, anon, authenticated;
revoke all on function private.marketplace_guard_listing_write() from public, anon, authenticated;
revoke all on function private.marketplace_guard_offer_state() from public, anon, authenticated;
revoke all on function private.marketplace_guard_transaction_state() from public, anon, authenticated;
revoke all on function private.marketplace_guard_credit_event() from public, anon, authenticated;
revoke all on function private.marketplace_capture_transaction_terms() from public, anon, authenticated;
revoke all on function private.marketplace_reject_immutable_change() from public, anon, authenticated;

-- Rollback: pause transactions, then use a forward migration. Do not delete
-- accepted terms or rewrite terminal state/history.
