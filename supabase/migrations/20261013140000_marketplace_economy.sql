alter table public.garments
  add column if not exists marketplace_archived_at timestamptz;

create table public.marketplace_config (
  id boolean primary key default true check (id),
  annual_price_cents integer not null default 10000 check (annual_price_cents > 0),
  currency_code text not null default 'CAD' check (char_length(currency_code) = 3),
  first_year_credit_grant integer not null default 500 check (first_year_credit_grant >= 0),
  renewal_credit_grant integer not null default 250 check (renewal_credit_grant >= 0),
  billing_mode text not null default 'development' check (billing_mode in ('development', 'store')),
  transactions_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.marketplace_config (id)
values (true)
on conflict (id) do nothing;

create table public.marketplace_memberships (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  renewal_count integer not null default 0 check (renewal_count >= 0),
  plan_version text not null default 'pilot-2026-10',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > starts_at)
);

create table public.marketplace_credit_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  available_balance integer not null default 0 check (available_balance >= 0),
  reserved_balance integer not null default 0 check (reserved_balance >= 0),
  updated_at timestamptz not null default now()
);

create table public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  garment_id uuid not null references public.garments(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'reserved', 'completed', 'withdrawn')),
  accepts_credits boolean not null default false,
  accepts_swap boolean not null default false,
  is_giveaway boolean not null default false,
  credit_price integer check (credit_price between 1 and 10000),
  pickup_area text not null check (char_length(trim(pickup_area)) between 2 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (accepts_credits or accepts_swap or is_giveaway),
  check ((accepts_credits and credit_price is not null) or (not accepts_credits and credit_price is null))
);

create unique index marketplace_one_open_listing_per_garment
  on public.marketplace_listings(garment_id)
  where status in ('active', 'reserved');
create index marketplace_active_listings_idx
  on public.marketplace_listings(status, created_at desc);
create index marketplace_seller_listings_idx
  on public.marketplace_listings(seller_id, created_at desc);

create table public.marketplace_offers (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete restrict,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  mode text not null check (mode in ('credits', 'swap', 'giveaway')),
  credit_amount integer check (credit_amount between 1 and 10000),
  swap_listing_id uuid references public.marketplace_listings(id) on delete restrict,
  message text check (char_length(message) <= 500),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'withdrawn', 'superseded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_id <> seller_id),
  check (
    (mode = 'credits' and credit_amount is not null and swap_listing_id is null)
    or (mode = 'swap' and credit_amount is null and swap_listing_id is not null)
    or (mode = 'giveaway' and credit_amount is null and swap_listing_id is null)
  )
);

create unique index marketplace_one_pending_offer_per_buyer
  on public.marketplace_offers(listing_id, buyer_id)
  where status = 'pending';
create index marketplace_seller_offers_idx
  on public.marketplace_offers(seller_id, status, created_at desc);
create index marketplace_buyer_offers_idx
  on public.marketplace_offers(buyer_id, status, created_at desc);

create table public.marketplace_transactions (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null unique references public.marketplace_offers(id) on delete restrict,
  listing_id uuid not null unique references public.marketplace_listings(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  mode text not null check (mode in ('credits', 'swap', 'giveaway')),
  credit_amount integer check (credit_amount between 1 and 10000),
  swap_listing_id uuid references public.marketplace_listings(id) on delete restrict,
  status text not null default 'awaiting_handoff' check (status in ('awaiting_handoff', 'completed', 'cancelled', 'disputed')),
  buyer_confirmed_at timestamptz,
  seller_confirmed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_id <> seller_id),
  check (
    (mode = 'credits' and credit_amount is not null and swap_listing_id is null)
    or (mode = 'swap' and credit_amount is null and swap_listing_id is not null)
    or (mode = 'giveaway' and credit_amount is null and swap_listing_id is null)
  )
);

create unique index marketplace_one_open_swap_transaction
  on public.marketplace_transactions(swap_listing_id)
  where status in ('awaiting_handoff', 'disputed') and swap_listing_id is not null;
create index marketplace_buyer_transactions_idx
  on public.marketplace_transactions(buyer_id, created_at desc);
create index marketplace_seller_transactions_idx
  on public.marketplace_transactions(seller_id, created_at desc);

create table public.marketplace_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  offer_id uuid references public.marketplace_offers(id) on delete restrict,
  transaction_id uuid references public.marketplace_transactions(id) on delete restrict,
  kind text not null check (kind in ('membership_grant', 'renewal_grant', 'offer_reserve', 'offer_release', 'transfer_out', 'transfer_in', 'cancellation_release', 'adjustment')),
  delta_available integer not null default 0,
  delta_reserved integer not null default 0,
  idempotency_key text not null unique,
  description text not null,
  created_at timestamptz not null default now(),
  check (delta_available <> 0 or delta_reserved <> 0)
);

alter table public.marketplace_config enable row level security;
alter table public.marketplace_memberships enable row level security;
alter table public.marketplace_credit_accounts enable row level security;
alter table public.marketplace_credit_ledger enable row level security;
alter table public.marketplace_listings enable row level security;
alter table public.marketplace_offers enable row level security;
alter table public.marketplace_transactions enable row level security;

create policy "marketplace_config_authenticated_read"
  on public.marketplace_config for select to authenticated using (true);
create policy "marketplace_memberships_read_own"
  on public.marketplace_memberships for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "marketplace_credit_accounts_read_own"
  on public.marketplace_credit_accounts for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "marketplace_credit_ledger_read_own"
  on public.marketplace_credit_ledger for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "marketplace_listings_authenticated_read"
  on public.marketplace_listings for select to authenticated
  using (seller_id = (select auth.uid()) or status in ('active', 'reserved'));
create policy "marketplace_offers_participant_read"
  on public.marketplace_offers for select to authenticated
  using (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()));
create policy "marketplace_transactions_participant_read"
  on public.marketplace_transactions for select to authenticated
  using (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()));

grant select on public.marketplace_config to authenticated;
grant select on public.marketplace_memberships to authenticated;
grant select on public.marketplace_credit_accounts to authenticated;
grant select on public.marketplace_credit_ledger to authenticated;
grant select on public.marketplace_listings to authenticated;
grant select on public.marketplace_offers to authenticated;
grant select on public.marketplace_transactions to authenticated;

revoke insert, update, delete on public.marketplace_config from anon, authenticated;
revoke insert, update, delete on public.marketplace_memberships from anon, authenticated;
revoke insert, update, delete on public.marketplace_credit_accounts from anon, authenticated;
revoke insert, update, delete on public.marketplace_credit_ledger from anon, authenticated;
revoke insert, update, delete on public.marketplace_listings from anon, authenticated;
revoke insert, update, delete on public.marketplace_offers from anon, authenticated;
revoke insert, update, delete on public.marketplace_transactions from anon, authenticated;

create or replace function private.marketplace_has_active_membership(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.marketplace_memberships
    where user_id = p_user_id
      and status = 'active'
      and expires_at > now()
  );
$$;

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
  if p_new_status not in ('rejected', 'withdrawn', 'superseded') then
    raise exception 'Invalid offer release status';
  end if;
  if p_ledger_kind not in ('offer_release', 'cancellation_release') then
    raise exception 'Invalid offer release ledger kind';
  end if;

  select * into v_offer
  from public.marketplace_offers
  where id = p_offer_id
  for update;

  if not found or v_offer.status <> 'pending' then
    return;
  end if;

  if v_offer.mode = 'credits' then
    insert into public.marketplace_credit_ledger (
      user_id, offer_id, kind, delta_available, delta_reserved, idempotency_key, description
    ) values (
      v_offer.buyer_id,
      v_offer.id,
      p_ledger_kind,
      v_offer.credit_amount,
      -v_offer.credit_amount,
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
      where user_id = v_offer.buyer_id
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

create or replace function public.marketplace_my_summary()
returns table (
  annual_price_cents integer,
  currency_code text,
  first_year_credit_grant integer,
  renewal_credit_grant integer,
  billing_mode text,
  membership_status text,
  membership_starts_at timestamptz,
  membership_expires_at timestamptz,
  available_credits integer,
  reserved_credits integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.annual_price_cents,
    c.currency_code,
    c.first_year_credit_grant,
    c.renewal_credit_grant,
    c.billing_mode,
    case
      when m.status = 'active' and m.expires_at > now() then 'active'
      when m.user_id is null then 'none'
      else 'expired'
    end,
    m.starts_at,
    m.expires_at,
    coalesce(a.available_balance, 0),
    coalesce(a.reserved_balance, 0)
  from public.marketplace_config c
  left join public.marketplace_memberships m on m.user_id = (select auth.uid())
  left join public.marketplace_credit_accounts a on a.user_id = (select auth.uid())
  where c.id = true and (select auth.uid()) is not null;
$$;

create or replace function public.marketplace_activate_membership()
returns table (
  membership_status text,
  membership_expires_at timestamptz,
  available_credits integer,
  reserved_credits integer,
  credits_granted integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_config public.marketplace_config%rowtype;
  v_membership public.marketplace_memberships%rowtype;
  v_grant integer;
  v_ledger_id uuid;
  v_expiry timestamptz;
  v_is_first boolean;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select * into v_config from public.marketplace_config where id = true;
  if v_config.billing_mode <> 'development' then
    raise exception 'Membership must be activated through the configured store';
  end if;

  select * into v_membership
  from public.marketplace_memberships
  where user_id = v_user_id
  for update;

  if found and v_membership.status = 'active' and v_membership.expires_at > now() then
    return query
      select 'active'::text, v_membership.expires_at,
        coalesce(a.available_balance, 0), coalesce(a.reserved_balance, 0), 0
      from public.marketplace_credit_accounts a where a.user_id = v_user_id;
    return;
  end if;

  v_is_first := not found;
  v_grant := case when v_is_first then v_config.first_year_credit_grant else v_config.renewal_credit_grant end;
  v_expiry := now() + interval '1 year';

  insert into public.marketplace_memberships (
    user_id, status, starts_at, expires_at, renewal_count, updated_at
  ) values (
    v_user_id, 'active', now(), v_expiry, 0, now()
  )
  on conflict (user_id) do update
    set status = 'active',
        starts_at = now(),
        expires_at = excluded.expires_at,
        renewal_count = public.marketplace_memberships.renewal_count + 1,
        updated_at = now();

  insert into public.marketplace_credit_accounts (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  insert into public.marketplace_credit_ledger (
    user_id, kind, delta_available, delta_reserved, idempotency_key, description
  ) values (
    v_user_id,
    case when v_is_first then 'membership_grant' else 'renewal_grant' end,
    v_grant,
    0,
    case when v_is_first
      then 'membership:first:' || v_user_id::text
      else 'membership:renewal:' || v_user_id::text || ':' || (v_membership.renewal_count + 1)::text
    end,
    case when v_is_first then 'First-year membership credit grant' else 'Annual renewal credit grant' end
  )
  on conflict (idempotency_key) do nothing
  returning id into v_ledger_id;

  if v_ledger_id is not null then
    update public.marketplace_credit_accounts
    set available_balance = available_balance + v_grant, updated_at = now()
    where user_id = v_user_id;
  else
    v_grant := 0;
  end if;

  return query
    select 'active'::text, v_expiry, a.available_balance, a.reserved_balance, v_grant
    from public.marketplace_credit_accounts a where a.user_id = v_user_id;
end;
$$;

create or replace function public.marketplace_publish_listing(
  p_garment_id uuid,
  p_accepts_credits boolean,
  p_accepts_swap boolean,
  p_is_giveaway boolean,
  p_credit_price integer,
  p_pickup_area text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_listing_id uuid;
  v_status text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not private.marketplace_has_active_membership(v_user_id) then raise exception 'Active marketplace membership required'; end if;
  if not (p_accepts_credits or p_accepts_swap or p_is_giveaway) then raise exception 'Choose at least one listing mode'; end if;
  if (p_accepts_credits and (p_credit_price is null or p_credit_price not between 1 and 10000))
    or (not p_accepts_credits and p_credit_price is not null) then raise exception 'Invalid credit price'; end if;
  if char_length(trim(coalesce(p_pickup_area, ''))) not between 2 and 80 then raise exception 'Invalid pickup area'; end if;

  perform 1 from public.garments
  where id = p_garment_id and user_id = v_user_id and status = 'ready' and marketplace_archived_at is null
  for update;
  if not found then raise exception 'Garment is not eligible for listing'; end if;

  select id, status into v_listing_id, v_status
  from public.marketplace_listings
  where garment_id = p_garment_id and status in ('active', 'reserved')
  for update;

  if v_status = 'reserved' then raise exception 'Reserved listings cannot be edited'; end if;
  if v_listing_id is not null then
    update public.marketplace_listings
    set accepts_credits = p_accepts_credits,
        accepts_swap = p_accepts_swap,
        is_giveaway = p_is_giveaway,
        credit_price = p_credit_price,
        pickup_area = trim(p_pickup_area),
        updated_at = now()
    where id = v_listing_id;
    return v_listing_id;
  end if;

  insert into public.marketplace_listings (
    garment_id, seller_id, accepts_credits, accepts_swap, is_giveaway, credit_price, pickup_area
  ) values (
    p_garment_id, v_user_id, p_accepts_credits, p_accepts_swap, p_is_giveaway, p_credit_price, trim(p_pickup_area)
  ) returning id into v_listing_id;
  return v_listing_id;
end;
$$;

create or replace function public.marketplace_withdraw_listing(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_offer record;
begin
  perform 1 from public.marketplace_listings
  where id = p_listing_id and seller_id = v_user_id and status = 'active'
  for update;
  if not found then raise exception 'Only an active listing can be withdrawn'; end if;

  for v_offer in
    select id from public.marketplace_offers where listing_id = p_listing_id and status = 'pending' for update
  loop
    perform private.marketplace_release_offer(v_offer.id, 'superseded');
  end loop;

  update public.marketplace_listings set status = 'withdrawn', updated_at = now() where id = p_listing_id;
end;
$$;

create or replace function public.marketplace_discover_listings()
returns table (
  id uuid, garment_id uuid, seller_id uuid, seller_name text, status text,
  accepts_credits boolean, accepts_swap boolean, is_giveaway boolean,
  credit_price integer, pickup_area text, garment_name text, category text,
  color text, size text, image_path text, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.garment_id, l.seller_id,
    coalesce(nullif(trim(p.display_name), ''), 'Fitly member'), l.status,
    l.accepts_credits, l.accepts_swap, l.is_giveaway, l.credit_price,
    l.pickup_area, coalesce(g.name, 'Untitled piece'), g.category, g.color, g.size,
    coalesce(g.clean_path, g.original_path), l.created_at
  from public.marketplace_listings l
  join public.garments g on g.id = l.garment_id
  join public.profiles p on p.id = l.seller_id
  where (select auth.uid()) is not null and l.status = 'active'
  order by l.created_at desc;
$$;

create or replace function public.marketplace_create_offer(
  p_listing_id uuid,
  p_mode text,
  p_swap_listing_id uuid default null,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_listing public.marketplace_listings%rowtype;
  v_offer_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not private.marketplace_has_active_membership(v_user_id) then raise exception 'Active marketplace membership required'; end if;
  if p_mode not in ('credits', 'swap', 'giveaway') then raise exception 'Invalid offer mode'; end if;
  if char_length(coalesce(p_message, '')) > 500 then raise exception 'Message is too long'; end if;

  select * into v_listing from public.marketplace_listings where id = p_listing_id for update;
  if not found or v_listing.status <> 'active' then raise exception 'Listing is not available'; end if;
  if v_listing.seller_id = v_user_id then raise exception 'You cannot make an offer on your own listing'; end if;

  select id into v_offer_id from public.marketplace_offers
  where listing_id = p_listing_id and buyer_id = v_user_id and status = 'pending';
  if v_offer_id is not null then return v_offer_id; end if;

  if p_mode = 'credits' and not v_listing.accepts_credits then raise exception 'Listing does not accept credits'; end if;
  if p_mode = 'giveaway' and not v_listing.is_giveaway then raise exception 'Listing is not a give-away'; end if;
  if p_mode = 'swap' then
    if not v_listing.accepts_swap or p_swap_listing_id is null then raise exception 'A valid swap listing is required'; end if;
    perform 1 from public.marketplace_listings
    where id = p_swap_listing_id and seller_id = v_user_id and status = 'active' and accepts_swap
    for update;
    if not found or p_swap_listing_id = p_listing_id then raise exception 'Swap listing is not available'; end if;
  elsif p_swap_listing_id is not null then
    raise exception 'Swap listing only applies to swap offers';
  end if;

  insert into public.marketplace_offers (
    listing_id, buyer_id, seller_id, mode, credit_amount, swap_listing_id, message
  ) values (
    v_listing.id, v_user_id, v_listing.seller_id, p_mode,
    case when p_mode = 'credits' then v_listing.credit_price else null end,
    case when p_mode = 'swap' then p_swap_listing_id else null end,
    nullif(trim(coalesce(p_message, '')), '')
  ) returning id into v_offer_id;

  if p_mode = 'credits' then
    update public.marketplace_credit_accounts
    set available_balance = available_balance - v_listing.credit_price,
        reserved_balance = reserved_balance + v_listing.credit_price,
        updated_at = now()
    where user_id = v_user_id and available_balance >= v_listing.credit_price;
    if not found then raise exception 'Insufficient Fitly Credits'; end if;

    insert into public.marketplace_credit_ledger (
      user_id, offer_id, kind, delta_available, delta_reserved, idempotency_key, description
    ) values (
      v_user_id, v_offer_id, 'offer_reserve', -v_listing.credit_price, v_listing.credit_price,
      'offer-reserve:' || v_offer_id::text, 'Credits reserved for an offer'
    );
  end if;
  return v_offer_id;
end;
$$;

create or replace function public.marketplace_respond_to_offer(p_offer_id uuid, p_accept boolean)
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
  select * into v_offer from public.marketplace_offers where id = p_offer_id for update;
  if not found or v_offer.seller_id <> v_user_id or v_offer.status <> 'pending' then
    raise exception 'Pending offer not found';
  end if;
  if not p_accept then
    perform private.marketplace_release_offer(v_offer.id, 'rejected');
    return null;
  end if;
  if not private.marketplace_has_active_membership(v_user_id)
    or not private.marketplace_has_active_membership(v_offer.buyer_id) then
    raise exception 'Both members need an active membership';
  end if;

  perform 1 from public.marketplace_listings where id = v_offer.listing_id and status = 'active' for update;
  if not found then raise exception 'Listing is no longer available'; end if;
  if v_offer.mode = 'swap' then
    perform 1 from public.marketplace_listings
    where id = v_offer.swap_listing_id and seller_id = v_offer.buyer_id and status = 'active'
    for update;
    if not found then raise exception 'Swap listing is no longer available'; end if;
  end if;

  insert into public.marketplace_transactions (
    offer_id, listing_id, seller_id, buyer_id, mode, credit_amount, swap_listing_id
  ) values (
    v_offer.id, v_offer.listing_id, v_offer.seller_id, v_offer.buyer_id,
    v_offer.mode, v_offer.credit_amount, v_offer.swap_listing_id
  ) returning id into v_transaction_id;

  update public.marketplace_offers set status = 'accepted', updated_at = now() where id = v_offer.id;
  update public.marketplace_listings set status = 'reserved', updated_at = now() where id = v_offer.listing_id;
  if v_offer.swap_listing_id is not null then
    update public.marketplace_listings set status = 'reserved', updated_at = now() where id = v_offer.swap_listing_id;
  end if;

  for v_competing in
    select id from public.marketplace_offers
    where status = 'pending'
      and id <> v_offer.id
      and (listing_id = v_offer.listing_id or listing_id = v_offer.swap_listing_id)
    for update
  loop
    perform private.marketplace_release_offer(v_competing.id, 'superseded');
  end loop;
  return v_transaction_id;
end;
$$;

create or replace function public.marketplace_withdraw_offer(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  perform 1 from public.marketplace_offers
  where id = p_offer_id and buyer_id = v_user_id and status = 'pending'
  for update;
  if not found then raise exception 'Pending offer not found'; end if;
  perform private.marketplace_release_offer(p_offer_id, 'withdrawn');
end;
$$;

create or replace function public.marketplace_confirm_handoff(p_transaction_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_tx public.marketplace_transactions%rowtype;
  v_now timestamptz := now();
begin
  select * into v_tx from public.marketplace_transactions where id = p_transaction_id for update;
  if not found or v_user_id not in (v_tx.buyer_id, v_tx.seller_id) then raise exception 'Transaction not found'; end if;
  if v_tx.status = 'completed' then return 'completed'; end if;
  if v_tx.status <> 'awaiting_handoff' then raise exception 'Transaction cannot be confirmed'; end if;

  if v_user_id = v_tx.buyer_id then v_tx.buyer_confirmed_at := coalesce(v_tx.buyer_confirmed_at, v_now); end if;
  if v_user_id = v_tx.seller_id then v_tx.seller_confirmed_at := coalesce(v_tx.seller_confirmed_at, v_now); end if;
  update public.marketplace_transactions
  set buyer_confirmed_at = v_tx.buyer_confirmed_at,
      seller_confirmed_at = v_tx.seller_confirmed_at,
      updated_at = v_now
  where id = v_tx.id;

  if v_tx.buyer_confirmed_at is null or v_tx.seller_confirmed_at is null then return 'awaiting_handoff'; end if;

  if v_tx.mode = 'credits' then
    update public.marketplace_credit_accounts
    set reserved_balance = reserved_balance - v_tx.credit_amount, updated_at = v_now
    where user_id = v_tx.buyer_id and reserved_balance >= v_tx.credit_amount;
    if not found then raise exception 'Reserved credit balance is inconsistent'; end if;
    insert into public.marketplace_credit_accounts (user_id) values (v_tx.seller_id) on conflict (user_id) do nothing;
    update public.marketplace_credit_accounts
    set available_balance = available_balance + v_tx.credit_amount, updated_at = v_now
    where user_id = v_tx.seller_id;
    insert into public.marketplace_credit_ledger (
      user_id, transaction_id, kind, delta_available, delta_reserved, idempotency_key, description
    ) values
      (v_tx.buyer_id, v_tx.id, 'transfer_out', 0, -v_tx.credit_amount, 'transaction:' || v_tx.id::text || ':out', 'Credits transferred for a completed exchange'),
      (v_tx.seller_id, v_tx.id, 'transfer_in', v_tx.credit_amount, 0, 'transaction:' || v_tx.id::text || ':in', 'Credits earned from a completed exchange');
  end if;

  update public.marketplace_transactions
  set status = 'completed', completed_at = v_now, updated_at = v_now where id = v_tx.id;
  update public.marketplace_listings
  set status = 'completed', updated_at = v_now where id = v_tx.listing_id or id = v_tx.swap_listing_id;
  update public.garments g
  set marketplace_archived_at = v_now
  where exists (
    select 1 from public.marketplace_listings l
    where l.garment_id = g.id and (l.id = v_tx.listing_id or l.id = v_tx.swap_listing_id)
  );
  return 'completed';
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
  select * into v_tx from public.marketplace_transactions where id = p_transaction_id for update;
  if not found or v_user_id not in (v_tx.buyer_id, v_tx.seller_id) then raise exception 'Transaction not found'; end if;
  if v_tx.status <> 'awaiting_handoff' then raise exception 'Only an open transaction can be cancelled'; end if;

  if v_tx.mode = 'credits' then
    insert into public.marketplace_credit_ledger (
      user_id, offer_id, transaction_id, kind, delta_available, delta_reserved, idempotency_key, description
    ) values (
      v_tx.buyer_id, v_tx.offer_id, v_tx.id, 'cancellation_release', v_tx.credit_amount, -v_tx.credit_amount,
      'transaction:' || v_tx.id::text || ':cancel', 'Credits released after cancellation'
    ) on conflict (idempotency_key) do nothing returning id into v_ledger_id;
    if v_ledger_id is not null then
      update public.marketplace_credit_accounts
      set available_balance = available_balance + v_tx.credit_amount,
          reserved_balance = reserved_balance - v_tx.credit_amount,
          updated_at = now()
      where user_id = v_tx.buyer_id and reserved_balance >= v_tx.credit_amount;
      if not found then raise exception 'Reserved credit balance is inconsistent'; end if;
    end if;
  end if;

  update public.marketplace_transactions
  set status = 'cancelled', cancelled_at = now(), updated_at = now() where id = v_tx.id;
  update public.marketplace_listings
  set status = 'active', updated_at = now() where id = v_tx.listing_id or id = v_tx.swap_listing_id;
end;
$$;

create or replace function public.marketplace_my_offers()
returns table (
  id uuid, listing_id uuid, listing_name text, image_path text,
  buyer_id uuid, seller_id uuid, mode text, credit_amount integer,
  swap_listing_id uuid, swap_listing_name text, message text, status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.listing_id, coalesce(g.name, 'Untitled piece'), coalesce(g.clean_path, g.original_path),
    o.buyer_id, o.seller_id, o.mode, o.credit_amount, o.swap_listing_id,
    sg.name, o.message, o.status, o.created_at
  from public.marketplace_offers o
  join public.marketplace_listings l on l.id = o.listing_id
  join public.garments g on g.id = l.garment_id
  left join public.marketplace_listings sl on sl.id = o.swap_listing_id
  left join public.garments sg on sg.id = sl.garment_id
  where o.buyer_id = (select auth.uid()) or o.seller_id = (select auth.uid())
  order by o.created_at desc;
$$;

create or replace function public.marketplace_my_transactions()
returns table (
  id uuid, listing_id uuid, listing_name text, image_path text,
  buyer_id uuid, seller_id uuid, mode text, credit_amount integer,
  swap_listing_id uuid, swap_listing_name text, status text,
  buyer_confirmed_at timestamptz, seller_confirmed_at timestamptz,
  completed_at timestamptz, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.listing_id, coalesce(g.name, 'Untitled piece'), coalesce(g.clean_path, g.original_path),
    t.buyer_id, t.seller_id, t.mode, t.credit_amount, t.swap_listing_id,
    sg.name, t.status, t.buyer_confirmed_at, t.seller_confirmed_at, t.completed_at, t.created_at
  from public.marketplace_transactions t
  join public.marketplace_listings l on l.id = t.listing_id
  join public.garments g on g.id = l.garment_id
  left join public.marketplace_listings sl on sl.id = t.swap_listing_id
  left join public.garments sg on sg.id = sl.garment_id
  where t.buyer_id = (select auth.uid()) or t.seller_id = (select auth.uid())
  order by t.created_at desc;
$$;

create policy "listed_garment_images_authenticated"
on storage.objects for select to authenticated
using (
  bucket_id = 'garments'
  and exists (
    select 1
    from public.marketplace_listings l
    join public.garments g on g.id = l.garment_id
    where name in (g.original_path, g.clean_path)
      and (
        l.status in ('active', 'reserved')
        or exists (
          select 1 from public.marketplace_transactions t
          where (t.listing_id = l.id or t.swap_listing_id = l.id)
            and (t.buyer_id = (select auth.uid()) or t.seller_id = (select auth.uid()))
        )
      )
  )
);

revoke all on function private.marketplace_has_active_membership(uuid) from public, anon, authenticated;
revoke all on function private.marketplace_release_offer(uuid, text, text) from public, anon, authenticated;

revoke all on function public.marketplace_my_summary() from public, anon;
revoke all on function public.marketplace_activate_membership() from public, anon;
revoke all on function public.marketplace_publish_listing(uuid, boolean, boolean, boolean, integer, text) from public, anon;
revoke all on function public.marketplace_withdraw_listing(uuid) from public, anon;
revoke all on function public.marketplace_discover_listings() from public, anon;
revoke all on function public.marketplace_create_offer(uuid, text, uuid, text) from public, anon;
revoke all on function public.marketplace_respond_to_offer(uuid, boolean) from public, anon;
revoke all on function public.marketplace_withdraw_offer(uuid) from public, anon;
revoke all on function public.marketplace_confirm_handoff(uuid) from public, anon;
revoke all on function public.marketplace_cancel_transaction(uuid) from public, anon;
revoke all on function public.marketplace_my_offers() from public, anon;
revoke all on function public.marketplace_my_transactions() from public, anon;

grant execute on function public.marketplace_my_summary() to authenticated;
grant execute on function public.marketplace_activate_membership() to authenticated;
grant execute on function public.marketplace_publish_listing(uuid, boolean, boolean, boolean, integer, text) to authenticated;
grant execute on function public.marketplace_withdraw_listing(uuid) to authenticated;
grant execute on function public.marketplace_discover_listings() to authenticated;
grant execute on function public.marketplace_create_offer(uuid, text, uuid, text) to authenticated;
grant execute on function public.marketplace_respond_to_offer(uuid, boolean) to authenticated;
grant execute on function public.marketplace_withdraw_offer(uuid) to authenticated;
grant execute on function public.marketplace_confirm_handoff(uuid) to authenticated;
grant execute on function public.marketplace_cancel_transaction(uuid) to authenticated;
grant execute on function public.marketplace_my_offers() to authenticated;
grant execute on function public.marketplace_my_transactions() to authenticated;
