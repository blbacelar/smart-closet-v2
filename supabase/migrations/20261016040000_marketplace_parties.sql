-- Introduce a durable, opaque marketplace identity that can outlive a public
-- profile without retaining the Auth UUID in transaction/accounting records.
-- Legacy user columns remain nullable during the SDK compatibility window.

create table private.marketplace_parties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

revoke all on private.marketplace_parties from public, anon, authenticated;

alter table public.marketplace_memberships add column party_id uuid;
alter table public.marketplace_credit_accounts add column party_id uuid;
alter table public.marketplace_listings add column seller_party_id uuid;
alter table public.marketplace_offers
  add column buyer_party_id uuid,
  add column seller_party_id uuid;
alter table public.marketplace_transactions
  add column buyer_party_id uuid,
  add column seller_party_id uuid;
alter table public.marketplace_credit_ledger add column party_id uuid;

insert into private.marketplace_parties (user_id)
select distinct participant.user_id
from (
  select user_id from public.marketplace_memberships
  union all
  select user_id from public.marketplace_credit_accounts
  union all
  select seller_id from public.marketplace_listings
  union all
  select buyer_id from public.marketplace_offers
  union all
  select seller_id from public.marketplace_offers
  union all
  select buyer_id from public.marketplace_transactions
  union all
  select seller_id from public.marketplace_transactions
  union all
  select user_id from public.marketplace_credit_ledger
) participant
where participant.user_id is not null
on conflict (user_id) do nothing;

update public.marketplace_memberships record
set party_id = party.id
from private.marketplace_parties party
where party.user_id = record.user_id;

update public.marketplace_credit_accounts record
set party_id = party.id
from private.marketplace_parties party
where party.user_id = record.user_id;

update public.marketplace_listings record
set seller_party_id = party.id
from private.marketplace_parties party
where party.user_id = record.seller_id;

update public.marketplace_offers record
set buyer_party_id = buyer_party.id,
    seller_party_id = seller_party.id
from private.marketplace_parties buyer_party,
     private.marketplace_parties seller_party
where buyer_party.user_id = record.buyer_id
  and seller_party.user_id = record.seller_id;

update public.marketplace_transactions record
set buyer_party_id = buyer_party.id,
    seller_party_id = seller_party.id
from private.marketplace_parties buyer_party,
     private.marketplace_parties seller_party
where buyer_party.user_id = record.buyer_id
  and seller_party.user_id = record.seller_id;

update public.marketplace_credit_ledger record
set party_id = party.id
from private.marketplace_parties party
where party.user_id = record.user_id;

alter table public.marketplace_memberships
  alter column party_id set not null,
  add constraint marketplace_memberships_party_id_fkey
    foreign key (party_id) references private.marketplace_parties(id) on delete restrict;
alter table public.marketplace_credit_accounts
  alter column party_id set not null,
  add constraint marketplace_credit_accounts_party_id_fkey
    foreign key (party_id) references private.marketplace_parties(id) on delete restrict;
alter table public.marketplace_listings
  alter column seller_party_id set not null,
  add constraint marketplace_listings_seller_party_id_fkey
    foreign key (seller_party_id) references private.marketplace_parties(id) on delete restrict;
alter table public.marketplace_offers
  alter column buyer_party_id set not null,
  alter column seller_party_id set not null,
  add constraint marketplace_offers_buyer_party_id_fkey
    foreign key (buyer_party_id) references private.marketplace_parties(id) on delete restrict,
  add constraint marketplace_offers_seller_party_id_fkey
    foreign key (seller_party_id) references private.marketplace_parties(id) on delete restrict,
  add constraint marketplace_offers_distinct_parties_check
    check (buyer_party_id <> seller_party_id);
alter table public.marketplace_transactions
  alter column buyer_party_id set not null,
  alter column seller_party_id set not null,
  add constraint marketplace_transactions_buyer_party_id_fkey
    foreign key (buyer_party_id) references private.marketplace_parties(id) on delete restrict,
  add constraint marketplace_transactions_seller_party_id_fkey
    foreign key (seller_party_id) references private.marketplace_parties(id) on delete restrict,
  add constraint marketplace_transactions_distinct_parties_check
    check (buyer_party_id <> seller_party_id);
alter table public.marketplace_credit_ledger
  alter column party_id set not null,
  add constraint marketplace_credit_ledger_party_id_fkey
    foreign key (party_id) references private.marketplace_parties(id) on delete restrict;

alter table public.marketplace_memberships
  drop constraint marketplace_memberships_pkey,
  drop constraint marketplace_memberships_user_id_fkey,
  alter column user_id drop not null,
  add constraint marketplace_memberships_pkey primary key (party_id),
  add constraint marketplace_memberships_user_id_key unique (user_id),
  add constraint marketplace_memberships_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete set null;

alter table public.marketplace_credit_accounts
  drop constraint marketplace_credit_accounts_pkey,
  drop constraint marketplace_credit_accounts_user_id_fkey,
  alter column user_id drop not null,
  add constraint marketplace_credit_accounts_pkey primary key (party_id),
  add constraint marketplace_credit_accounts_user_id_key unique (user_id),
  add constraint marketplace_credit_accounts_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete set null;

alter table public.marketplace_listings
  drop constraint marketplace_listings_seller_id_fkey,
  alter column seller_id drop not null,
  add constraint marketplace_listings_seller_id_fkey
    foreign key (seller_id) references public.profiles(id) on delete set null;

alter table public.marketplace_offers
  drop constraint marketplace_offers_buyer_id_fkey,
  drop constraint marketplace_offers_seller_id_fkey,
  alter column buyer_id drop not null,
  alter column seller_id drop not null,
  add constraint marketplace_offers_buyer_id_fkey
    foreign key (buyer_id) references public.profiles(id) on delete set null,
  add constraint marketplace_offers_seller_id_fkey
    foreign key (seller_id) references public.profiles(id) on delete set null;

alter table public.marketplace_transactions
  drop constraint marketplace_transactions_buyer_id_fkey,
  drop constraint marketplace_transactions_seller_id_fkey,
  alter column buyer_id drop not null,
  alter column seller_id drop not null,
  add constraint marketplace_transactions_buyer_id_fkey
    foreign key (buyer_id) references public.profiles(id) on delete set null,
  add constraint marketplace_transactions_seller_id_fkey
    foreign key (seller_id) references public.profiles(id) on delete set null;

alter table public.marketplace_credit_ledger
  drop constraint marketplace_credit_ledger_user_id_fkey,
  alter column user_id drop not null,
  add constraint marketplace_credit_ledger_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete set null;

create unique index marketplace_memberships_party_id_idx
  on public.marketplace_memberships(party_id);
create unique index marketplace_credit_accounts_party_id_idx
  on public.marketplace_credit_accounts(party_id);
create index marketplace_listings_seller_party_idx
  on public.marketplace_listings(seller_party_id, created_at desc);
create index marketplace_offers_buyer_party_idx
  on public.marketplace_offers(buyer_party_id, status, created_at desc);
create index marketplace_offers_seller_party_idx
  on public.marketplace_offers(seller_party_id, status, created_at desc);
create index marketplace_transactions_buyer_party_idx
  on public.marketplace_transactions(buyer_party_id, created_at desc);
create index marketplace_transactions_seller_party_idx
  on public.marketplace_transactions(seller_party_id, created_at desc);
create index marketplace_credit_ledger_party_idx
  on public.marketplace_credit_ledger(party_id, created_at desc);

create or replace function private.marketplace_ensure_party(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_party_id uuid;
begin
  if p_user_id is null then
    raise exception 'A live profile is required to create a marketplace party';
  end if;

  insert into private.marketplace_parties (user_id)
  values (p_user_id)
  on conflict (user_id) do update set user_id = excluded.user_id
  returning id into v_party_id;

  return v_party_id;
end;
$$;

create or replace function private.marketplace_sync_single_party()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_party_id uuid;
begin
  if new.user_id is null then
    if new.party_id is null then
      raise exception 'A marketplace party is required';
    end if;
    return new;
  end if;

  v_party_id := private.marketplace_ensure_party(new.user_id);
  if new.party_id is not null and new.party_id <> v_party_id then
    raise exception 'Marketplace party does not match the live profile';
  end if;
  new.party_id := v_party_id;
  return new;
end;
$$;

create or replace function private.marketplace_sync_seller_party()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_party_id uuid;
begin
  if new.seller_id is null then
    if new.seller_party_id is null then
      raise exception 'A seller marketplace party is required';
    end if;
    return new;
  end if;

  v_party_id := private.marketplace_ensure_party(new.seller_id);
  if new.seller_party_id is not null and new.seller_party_id <> v_party_id then
    raise exception 'Seller marketplace party does not match the live profile';
  end if;
  new.seller_party_id := v_party_id;
  return new;
end;
$$;

create or replace function private.marketplace_sync_participant_parties()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_buyer_party_id uuid;
  v_seller_party_id uuid;
begin
  if new.buyer_id is null then
    if new.buyer_party_id is null then
      raise exception 'A buyer marketplace party is required';
    end if;
  else
    v_buyer_party_id := private.marketplace_ensure_party(new.buyer_id);
    if new.buyer_party_id is not null and new.buyer_party_id <> v_buyer_party_id then
      raise exception 'Buyer marketplace party does not match the live profile';
    end if;
    new.buyer_party_id := v_buyer_party_id;
  end if;

  if new.seller_id is null then
    if new.seller_party_id is null then
      raise exception 'A seller marketplace party is required';
    end if;
  else
    v_seller_party_id := private.marketplace_ensure_party(new.seller_id);
    if new.seller_party_id is not null and new.seller_party_id <> v_seller_party_id then
      raise exception 'Seller marketplace party does not match the live profile';
    end if;
    new.seller_party_id := v_seller_party_id;
  end if;

  if new.buyer_party_id = new.seller_party_id then
    raise exception 'Buyer and seller marketplace parties must differ';
  end if;
  return new;
end;
$$;

create trigger marketplace_sync_single_party
before insert or update of user_id, party_id on public.marketplace_memberships
for each row execute function private.marketplace_sync_single_party();

create trigger marketplace_sync_single_party
before insert or update of user_id, party_id on public.marketplace_credit_accounts
for each row execute function private.marketplace_sync_single_party();

create trigger marketplace_sync_single_party
before insert or update of user_id, party_id on public.marketplace_credit_ledger
for each row execute function private.marketplace_sync_single_party();

create trigger marketplace_sync_seller_party
before insert or update of seller_id, seller_party_id on public.marketplace_listings
for each row execute function private.marketplace_sync_seller_party();

create trigger marketplace_sync_participant_parties
before insert or update of buyer_id, seller_id, buyer_party_id, seller_party_id
on public.marketplace_offers
for each row execute function private.marketplace_sync_participant_parties();

create trigger marketplace_sync_participant_parties
before insert or update of buyer_id, seller_id, buyer_party_id, seller_party_id
on public.marketplace_transactions
for each row execute function private.marketplace_sync_participant_parties();

create or replace function public.marketplace_party_matches(p_party_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.marketplace_parties party
    where party.id = p_party_id
      and party.user_id = (select auth.uid())
  );
$$;

drop policy "marketplace_memberships_read_own" on public.marketplace_memberships;
create policy "marketplace_memberships_read_own"
  on public.marketplace_memberships for select to authenticated
  using (public.marketplace_party_matches(party_id));

drop policy "marketplace_credit_accounts_read_own" on public.marketplace_credit_accounts;
create policy "marketplace_credit_accounts_read_own"
  on public.marketplace_credit_accounts for select to authenticated
  using (public.marketplace_party_matches(party_id));

drop policy "marketplace_credit_ledger_read_own" on public.marketplace_credit_ledger;
create policy "marketplace_credit_ledger_read_own"
  on public.marketplace_credit_ledger for select to authenticated
  using (public.marketplace_party_matches(party_id));

drop policy "marketplace_listings_authenticated_read" on public.marketplace_listings;
create policy "marketplace_listings_authenticated_read"
  on public.marketplace_listings for select to authenticated
  using (
    public.marketplace_party_matches(seller_party_id)
    or status in ('active', 'reserved')
  );

drop policy "marketplace_offers_participant_read" on public.marketplace_offers;
create policy "marketplace_offers_participant_read"
  on public.marketplace_offers for select to authenticated
  using (
    public.marketplace_party_matches(buyer_party_id)
    or public.marketplace_party_matches(seller_party_id)
  );

drop policy "marketplace_transactions_participant_read" on public.marketplace_transactions;
create policy "marketplace_transactions_participant_read"
  on public.marketplace_transactions for select to authenticated
  using (
    public.marketplace_party_matches(buyer_party_id)
    or public.marketplace_party_matches(seller_party_id)
  );

drop policy "marketplace_messages_participant_read" on public.marketplace_messages;
create policy "marketplace_messages_participant_read"
  on public.marketplace_messages for select to authenticated
  using (
    exists (
      select 1
      from public.marketplace_offers offer
      where offer.id = marketplace_messages.offer_id
        and (
          public.marketplace_party_matches(offer.buyer_party_id)
          or public.marketplace_party_matches(offer.seller_party_id)
        )
    )
  );

create or replace function public.marketplace_can_read_garment_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.marketplace_listings listing
    join public.garments garment on garment.id = listing.garment_id
    where p_name = coalesce(garment.clean_path, garment.original_path)
      and (
        listing.status = 'active'
        or exists (
          select 1
          from public.marketplace_transactions transaction_record
          where (
              transaction_record.listing_id = listing.id
              or transaction_record.swap_listing_id = listing.id
            )
            and (
              public.marketplace_party_matches(transaction_record.buyer_party_id)
              or public.marketplace_party_matches(transaction_record.seller_party_id)
            )
        )
      )
  );
$$;

revoke all on function private.marketplace_ensure_party(uuid) from public, anon, authenticated;
revoke all on function private.marketplace_sync_single_party() from public, anon, authenticated;
revoke all on function private.marketplace_sync_seller_party() from public, anon, authenticated;
revoke all on function private.marketplace_sync_participant_parties() from public, anon, authenticated;
revoke all on function public.marketplace_party_matches(uuid) from public, anon;
grant execute on function public.marketplace_party_matches(uuid) to authenticated;

comment on table private.marketplace_parties is
  'Opaque marketplace participant identity. The nullable user_id is only a live-profile compatibility link.';
comment on function public.marketplace_party_matches(uuid) is
  'Returns only whether the authenticated user owns a party; it never exposes the party mapping.';
