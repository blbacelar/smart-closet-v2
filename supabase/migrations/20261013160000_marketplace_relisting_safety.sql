-- A cancelled handoff re-opens its listing. Keep transaction history without
-- letting the cancelled row permanently block a later accepted offer.
alter table public.marketplace_transactions
  drop constraint if exists marketplace_transactions_listing_id_key;

create unique index if not exists marketplace_one_non_cancelled_transaction_per_listing
  on public.marketplace_transactions(listing_id)
  where status in ('awaiting_handoff', 'completed', 'disputed');

-- A garment can also be referenced as the offered side of a swap. Withdrawing
-- it must release every pending offer that depends on it, including any credit
-- reservation owned by the other side of those offers.
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
    select id
    from public.marketplace_offers
    where status = 'pending'
      and (listing_id = p_listing_id or swap_listing_id = p_listing_id)
    for update
  loop
    perform private.marketplace_release_offer(v_offer.id, 'superseded');
  end loop;

  update public.marketplace_listings
  set status = 'withdrawn', updated_at = now()
  where id = p_listing_id;
end;
$$;

-- Once a swap is accepted, no still-pending offer may keep either reserved
-- garment as its target or proposed swap piece.
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
  select * into v_offer
  from public.marketplace_offers
  where id = p_offer_id
  for update;

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

  perform 1
  from public.marketplace_listings
  where id = v_offer.listing_id and status = 'active'
  for update;
  if not found then raise exception 'Listing is no longer available'; end if;

  if v_offer.mode = 'swap' then
    perform 1
    from public.marketplace_listings
    where id = v_offer.swap_listing_id
      and seller_id = v_offer.buyer_id
      and status = 'active'
    for update;
    if not found then raise exception 'Swap listing is no longer available'; end if;
  end if;

  insert into public.marketplace_transactions (
    offer_id, listing_id, seller_id, buyer_id, mode, credit_amount, swap_listing_id
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
    select id
    from public.marketplace_offers
    where status = 'pending'
      and id <> v_offer.id
      and (
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

revoke all on function public.marketplace_withdraw_listing(uuid) from public, anon;
revoke all on function public.marketplace_respond_to_offer(uuid, boolean) from public, anon;
grant execute on function public.marketplace_withdraw_listing(uuid) to authenticated;
grant execute on function public.marketplace_respond_to_offer(uuid, boolean) to authenticated;
