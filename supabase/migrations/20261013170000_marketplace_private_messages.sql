begin;

create table public.marketplace_messages (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.marketplace_offers(id) on delete restrict,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index marketplace_messages_offer_created_idx
  on public.marketplace_messages(offer_id, created_at);

alter table public.marketplace_messages enable row level security;

create policy "marketplace_messages_participant_read"
  on public.marketplace_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.marketplace_offers o
      where o.id = offer_id
        and (o.buyer_id = (select auth.uid()) or o.seller_id = (select auth.uid()))
    )
  );

grant select on public.marketplace_messages to authenticated;
revoke insert, update, delete on public.marketplace_messages from anon, authenticated;

create or replace function public.marketplace_my_messages(p_offer_id uuid)
returns table (
  id uuid,
  offer_id uuid,
  sender_id uuid,
  body text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  perform 1
  from public.marketplace_offers o
  where o.id = p_offer_id
    and v_user_id in (o.buyer_id, o.seller_id);
  if not found then raise exception 'Offer conversation not found'; end if;

  return query
    select m.id, m.offer_id, m.sender_id, m.body, m.created_at
    from public.marketplace_messages m
    where m.offer_id = p_offer_id
    order by m.created_at, m.id;
end;
$$;

create or replace function public.marketplace_send_message(p_offer_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_offer public.marketplace_offers%rowtype;
  v_message_id uuid;
  v_body text := trim(coalesce(p_body, ''));
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if char_length(v_body) not between 1 and 1000 then
    raise exception 'Message must be between 1 and 1,000 characters';
  end if;

  select * into v_offer
  from public.marketplace_offers
  where id = p_offer_id;

  if not found or v_user_id not in (v_offer.buyer_id, v_offer.seller_id) then
    raise exception 'Offer conversation not found';
  end if;
  if v_offer.status not in ('pending', 'accepted') then
    raise exception 'This conversation is closed';
  end if;

  insert into public.marketplace_messages (offer_id, sender_id, body)
  values (v_offer.id, v_user_id, v_body)
  returning id into v_message_id;

  return v_message_id;
end;
$$;

revoke all on function public.marketplace_my_messages(uuid) from public, anon;
revoke all on function public.marketplace_send_message(uuid, text) from public, anon;
grant execute on function public.marketplace_my_messages(uuid) to authenticated;
grant execute on function public.marketplace_send_message(uuid, text) to authenticated;

commit;
