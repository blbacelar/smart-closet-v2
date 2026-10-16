-- Private, provider-neutral push infrastructure for C10. Marketplace event
-- production and final deep-link behavior are integrated separately in C11.

create or replace function private.notification_valid_route(p_route jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_route is null
    or (
      jsonb_typeof(p_route) = 'object'
      and (
        (
          p_route ->> 'kind' = 'marketplace_inbox'
          and (p_route - 'kind') = '{}'::jsonb
        )
        or (
          p_route ->> 'kind' in ('transaction', 'listing')
          and p_route ? 'id'
          and (p_route - 'kind' - 'id') = '{}'::jsonb
          and (p_route ->> 'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        )
      )
    );
$$;

create table private.notification_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  installation_id uuid not null,
  expo_token text not null
    check (expo_token ~ '^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$'),
  platform text not null check (platform in ('ios', 'android')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  disabled_reason text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz,
  check (
    (status = 'active' and disabled_at is null and disabled_reason is null)
    or (status = 'disabled' and disabled_at is not null and disabled_reason is not null)
  )
);

create unique index notification_active_installation_idx
  on private.notification_push_tokens(user_id, installation_id)
  where status = 'active';
create unique index notification_active_expo_token_idx
  on private.notification_push_tokens(expo_token)
  where status = 'active';
create index notification_push_token_user_idx
  on private.notification_push_tokens(user_id, status, last_seen_at desc);

create table private.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique check (length(event_key) between 1 and 180),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('marketplace_update', 'account_update')),
  route jsonb check (private.notification_valid_route(route)),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'awaiting_receipts', 'completed', 'dead')),
  attempts integer not null default 0 check (attempts >= 0 and attempts <= 5),
  available_at timestamptz not null default now(),
  claimed_by text,
  claimed_at timestamptz,
  lease_until timestamptz,
  last_error_code text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'processing' and claimed_by is not null and lease_until is not null)
    or (status <> 'processing')
  )
);

create index notification_outbox_claim_idx
  on private.notification_outbox(status, available_at, lease_until, created_at);

create table private.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid not null references private.notification_outbox(id) on delete cascade,
  token_id uuid not null references private.notification_push_tokens(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'retry', 'sending', 'ticketed', 'delivered', 'dead')),
  attempts integer not null default 0 check (attempts >= 0 and attempts <= 5),
  provider_ticket_id text unique,
  receipt_available_at timestamptz,
  receipt_attempts integer not null default 0 check (receipt_attempts >= 0 and receipt_attempts <= 5),
  receipt_claimed_by text,
  receipt_lease_until timestamptz,
  last_error_code text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (outbox_id, token_id)
);

create index notification_receipt_claim_idx
  on private.notification_deliveries(status, receipt_available_at, receipt_lease_until);

revoke all on private.notification_push_tokens from public, anon, authenticated;
revoke all on private.notification_outbox from public, anon, authenticated;
revoke all on private.notification_deliveries from public, anon, authenticated;

create or replace function private.notification_outbox_immutable_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.event_key is distinct from old.event_key
     or new.recipient_user_id is distinct from old.recipient_user_id
     or new.kind is distinct from old.kind
     or new.route is distinct from old.route then
    raise exception 'Notification event payload is immutable';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger notification_outbox_immutable_event
before update on private.notification_outbox
for each row execute function private.notification_outbox_immutable_event();

create or replace function public.register_push_token(
  p_expo_token text,
  p_installation_id uuid,
  p_platform text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_token_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_expo_token !~ '^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$'
     or length(p_expo_token) > 512
     or p_platform not in ('ios', 'android') then
    raise exception 'Invalid push token registration';
  end if;

  perform private.account_deletion_lock_subjects(array[v_user_id], '{}'::uuid[]);
  if private.account_deletion_active_request(v_user_id, null) is not null then
    raise exception 'Account deletion in progress';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_expo_token, 10102026));
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_installation_id::text, 10102026));

  select id into v_token_id
  from private.notification_push_tokens
  where user_id = v_user_id
    and installation_id = p_installation_id
    and expo_token = p_expo_token
    and status = 'active'
  for update;
  if v_token_id is not null then
    update private.notification_push_tokens
    set platform = p_platform, last_seen_at = now()
    where id = v_token_id;
    return v_token_id;
  end if;

  update private.notification_push_tokens
  set status = 'disabled',
      disabled_reason = 'rotated_or_reassigned',
      disabled_at = now(),
      last_seen_at = now()
  where status = 'active'
    and (
      (user_id = v_user_id and installation_id = p_installation_id)
      or expo_token = p_expo_token
    );

  insert into private.notification_push_tokens (
    user_id, installation_id, expo_token, platform, status,
    disabled_reason, disabled_at, last_seen_at
  ) values (
    v_user_id, p_installation_id, p_expo_token, p_platform, 'active',
    null, null, now()
  )
  returning id into v_token_id;

  return v_token_id;
end;
$$;

create or replace function public.disable_push_installation(
  p_installation_id uuid,
  p_reason text default 'user_disabled'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_reason not in ('user_disabled', 'logout') then raise exception 'Invalid disable reason'; end if;
  update private.notification_push_tokens
  set status = 'disabled', disabled_reason = p_reason, disabled_at = now(), last_seen_at = now()
  where user_id = v_user_id and installation_id = p_installation_id and status = 'active';
end;
$$;

create or replace function private.notification_disable_for_account_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.notification_deliveries delivery
  set status = 'dead', last_error_code = 'account_deletion', updated_at = now()
  where delivery.outbox_id in (
    select item.id from private.notification_outbox item
    where item.recipient_user_id = new.auth_user_id
  ) and delivery.status in ('pending', 'retry', 'sending');
  update private.notification_push_tokens
  set status = 'disabled', disabled_reason = 'account_deletion', disabled_at = now(), last_seen_at = now()
  where user_id = new.auth_user_id and status = 'active';
  update private.notification_outbox
  set status = 'dead', last_error_code = 'account_deletion', completed_at = now(),
      claimed_by = null, claimed_at = null, lease_until = null
  where recipient_user_id = new.auth_user_id
    and status in ('pending', 'processing', 'awaiting_receipts');
  return new;
end;
$$;

create trigger notification_disable_for_account_deletion
after insert on private.account_deletion_requests
for each row execute function private.notification_disable_for_account_deletion();

create or replace function public.notification_enqueue(
  p_event_key text,
  p_recipient_user_id uuid,
  p_kind text,
  p_route jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_existing private.notification_outbox%rowtype;
begin
  if p_kind not in ('marketplace_update', 'account_update')
     or not private.notification_valid_route(p_route)
     or length(p_event_key) not between 1 and 180 then
    raise exception 'Invalid notification event';
  end if;
  if not exists (select 1 from auth.users where id = p_recipient_user_id) then
    raise exception 'Notification recipient not found';
  end if;
  perform private.account_deletion_lock_subjects(array[p_recipient_user_id], '{}'::uuid[]);
  if private.account_deletion_active_request(p_recipient_user_id, null) is not null then
    raise exception 'Account deletion in progress';
  end if;

  insert into private.notification_outbox (event_key, recipient_user_id, kind, route)
  values (p_event_key, p_recipient_user_id, p_kind, p_route)
  on conflict (event_key) do nothing
  returning id into v_id;
  if v_id is not null then return v_id; end if;

  select * into strict v_existing
  from private.notification_outbox where event_key = p_event_key;
  if v_existing.recipient_user_id <> p_recipient_user_id
     or v_existing.kind <> p_kind
     or v_existing.route is distinct from p_route then
    raise exception 'Notification event key collision';
  end if;
  return v_existing.id;
end;
$$;

create or replace function public.notification_claim_outbox(
  p_worker_id text,
  p_limit integer default 25,
  p_lease interval default interval '2 minutes'
)
returns table(id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if length(trim(p_worker_id)) not between 1 and 100
     or p_limit not between 1 and 100
     or p_lease < interval '10 seconds'
     or p_lease > interval '10 minutes' then
    raise exception 'Invalid notification claim';
  end if;

  update private.notification_outbox
  set status = 'dead', last_error_code = 'retry_limit', completed_at = now(),
      claimed_by = null, claimed_at = null, lease_until = null
  where attempts >= 5 and status in ('pending', 'processing');

  update private.notification_deliveries delivery
  set status = 'dead', last_error_code = 'ambiguous_provider_attempt', updated_at = now()
  where delivery.status = 'sending'
    and exists (
      select 1 from private.notification_outbox item
      where item.id = delivery.outbox_id
        and item.status = 'processing'
        and item.lease_until < now()
    );

  return query
  with candidates as (
    select item.id
    from private.notification_outbox item
    where item.attempts < 5
      and (
        (item.status = 'pending' and item.available_at <= now())
        or (item.status = 'processing' and item.lease_until < now())
      )
    order by item.created_at
    for update skip locked
    limit p_limit
  )
  update private.notification_outbox item
  set status = 'processing', claimed_by = p_worker_id, claimed_at = now(),
      lease_until = now() + p_lease, updated_at = now()
  from candidates
  where item.id = candidates.id
  returning item.id;
end;
$$;

create or replace function public.notification_prepare_deliveries(p_outbox_id uuid)
returns table(
  delivery_id uuid,
  expo_token text,
  kind text,
  route jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from private.notification_outbox item
    where item.id = p_outbox_id and item.status = 'processing' and item.lease_until >= now()
  ) then raise exception 'Notification outbox lease is not active'; end if;

  insert into private.notification_deliveries (outbox_id, token_id)
  select p_outbox_id, token.id
  from private.notification_outbox item
  join private.notification_push_tokens token
    on token.user_id = item.recipient_user_id and token.status = 'active'
  where item.id = p_outbox_id
  on conflict (outbox_id, token_id) do nothing;

  update private.notification_deliveries
  set status = 'dead', last_error_code = 'retry_limit', updated_at = now()
  where outbox_id = p_outbox_id and status = 'retry' and attempts >= 5;

  return query
  with candidates as (
    select delivery.id
    from private.notification_deliveries delivery
    join private.notification_push_tokens token on token.id = delivery.token_id
    join private.notification_outbox item on item.id = delivery.outbox_id
    where delivery.outbox_id = p_outbox_id
      and delivery.status in ('pending', 'retry')
      and delivery.attempts < 5
      and token.status = 'active'
      and token.user_id = item.recipient_user_id
    order by delivery.created_at
    for update of delivery
  ), sending as (
    update private.notification_deliveries delivery
    set status = 'sending', attempts = attempts + 1, updated_at = now()
    from candidates
    where delivery.id = candidates.id
    returning delivery.id, delivery.outbox_id, delivery.token_id
  )
  select sending.id, token.expo_token, item.kind, item.route
  from sending
  join private.notification_push_tokens token on token.id = sending.token_id
  join private.notification_outbox item on item.id = sending.outbox_id
  order by sending.id;
end;
$$;

create or replace function public.notification_authorize_deliveries(
  p_outbox_id uuid,
  p_worker_id text,
  p_delivery_ids uuid[]
)
returns table(delivery_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.notification_deliveries delivery
  set status = 'dead', last_error_code = 'dispatch_revoked', updated_at = now()
  where delivery.outbox_id = p_outbox_id
    and delivery.id = any(coalesce(p_delivery_ids, '{}'::uuid[]))
    and delivery.status = 'sending'
    and not exists (
      select 1
      from private.notification_outbox item
      join private.notification_push_tokens token on token.id = delivery.token_id
      where item.id = delivery.outbox_id
        and item.status = 'processing'
        and item.claimed_by = p_worker_id
        and item.lease_until >= now()
        and token.status = 'active'
        and token.user_id = item.recipient_user_id
        and private.account_deletion_active_request(item.recipient_user_id, null) is null
    );

  return query
  select delivery.id
  from private.notification_deliveries delivery
  join private.notification_push_tokens token on token.id = delivery.token_id
  join private.notification_outbox item on item.id = delivery.outbox_id
  where delivery.outbox_id = p_outbox_id
    and delivery.id = any(coalesce(p_delivery_ids, '{}'::uuid[]))
    and delivery.status = 'sending'
    and item.status = 'processing'
    and item.claimed_by = p_worker_id
    and item.lease_until >= now()
    and token.status = 'active'
    and token.user_id = item.recipient_user_id
    and private.account_deletion_active_request(item.recipient_user_id, null) is null
  order by delivery.created_at;
end;
$$;

create or replace function public.notification_defer_without_provider(
  p_outbox_id uuid,
  p_worker_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.notification_outbox
  set status = 'pending', available_at = now() + interval '5 minutes',
      claimed_by = null, claimed_at = null, lease_until = null,
      last_error_code = 'provider_not_configured', updated_at = now()
  where id = p_outbox_id and status = 'processing' and claimed_by = p_worker_id;
  if not found then raise exception 'Notification outbox lease does not belong to worker'; end if;
end;
$$;

create or replace function public.notification_record_tickets(
  p_outbox_id uuid,
  p_worker_id text,
  p_results jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_state text;
  v_code text;
  v_delivery_id uuid;
  v_attempts integer;
  v_has_transient boolean := false;
  v_has_ambiguous boolean := false;
begin
  if jsonb_typeof(p_results) <> 'array' then raise exception 'Invalid ticket results'; end if;
  select attempts into v_attempts
  from private.notification_outbox
  where id = p_outbox_id and status = 'processing' and claimed_by = p_worker_id
    and lease_until >= now()
  for update;
  if not found then
    if exists (
      select 1 from private.notification_outbox
      where id = p_outbox_id and status = 'dead' and last_error_code = 'account_deletion'
    ) then return; end if;
    raise exception 'Notification outbox lease does not belong to worker';
  end if;

  for v_result in select value from jsonb_array_elements(p_results)
  loop
    v_state := v_result ->> 'state';
    v_code := coalesce(v_result ->> 'code', 'provider_error');
    v_delivery_id := nullif(v_result ->> 'deliveryId', '')::uuid;
    if v_delivery_id is null then
      v_has_transient := true;
    elsif v_state = 'ticketed' and nullif(v_result ->> 'ticketId', '') is not null then
      update private.notification_deliveries
      set status = 'ticketed',
          provider_ticket_id = v_result ->> 'ticketId',
          receipt_available_at = now() + interval '15 minutes',
          last_error_code = null, updated_at = now()
      where id = v_delivery_id and outbox_id = p_outbox_id
        and status = 'sending';
    elsif v_state = 'permanent-failure' then
      update private.notification_deliveries
      set status = 'dead', last_error_code = v_code, updated_at = now()
      where id = v_delivery_id and outbox_id = p_outbox_id and status = 'sending'
      returning token_id into v_delivery_id;
      if v_code = 'DeviceNotRegistered' and v_delivery_id is not null then
        update private.notification_push_tokens
        set status = 'disabled', disabled_reason = 'device_not_registered',
            disabled_at = now(), last_seen_at = now()
        where id = v_delivery_id and status = 'active';
      end if;
    elsif v_state = 'transient-failure' then
      v_has_transient := true;
      update private.notification_deliveries
      set status = case when attempts >= 5 then 'dead' else 'retry' end,
          last_error_code = v_code, updated_at = now()
      where id = v_delivery_id and outbox_id = p_outbox_id
        and status = 'sending';
    elsif v_state = 'ambiguous-failure' then
      v_has_ambiguous := true;
      update private.notification_deliveries
      set status = 'dead', last_error_code = v_code, updated_at = now()
      where id = v_delivery_id and outbox_id = p_outbox_id and status = 'sending';
    else
      raise exception 'Invalid ticket result';
    end if;
  end loop;

  v_attempts := least(v_attempts + 1, 5);
  if v_has_transient then
    update private.notification_outbox
    set status = case when v_attempts >= 5 then 'dead' else 'pending' end,
        attempts = v_attempts,
        available_at = now() + least(interval '1 hour', interval '1 minute' * power(2, v_attempts - 1)),
        claimed_by = null, claimed_at = null, lease_until = null,
        last_error_code = 'transient_provider_failure',
        completed_at = case when v_attempts >= 5 then now() else null end
    where id = p_outbox_id;
  elsif exists (
    select 1 from private.notification_deliveries
    where outbox_id = p_outbox_id and status = 'ticketed'
  ) then
    update private.notification_outbox
    set status = 'awaiting_receipts', attempts = v_attempts,
        claimed_by = null, claimed_at = null, lease_until = null, last_error_code = null
    where id = p_outbox_id;
  else
    update private.notification_outbox
    set status = 'completed', attempts = v_attempts, completed_at = now(),
        claimed_by = null, claimed_at = null, lease_until = null,
        last_error_code = case when v_has_ambiguous then 'ambiguous_provider_attempt' else null end
    where id = p_outbox_id;
  end if;
end;
$$;

create or replace function public.notification_claim_receipts(
  p_worker_id text,
  p_limit integer default 100,
  p_lease interval default interval '2 minutes'
)
returns table(delivery_id uuid, ticket_id text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with candidates as (
    select delivery.id
    from private.notification_deliveries delivery
    where delivery.status = 'ticketed'
      and delivery.provider_ticket_id is not null
      and delivery.receipt_attempts < 5
      and delivery.receipt_available_at <= now()
      and (delivery.receipt_lease_until is null or delivery.receipt_lease_until < now())
    order by delivery.receipt_available_at
    for update skip locked
    limit greatest(1, least(p_limit, 1000))
  )
  update private.notification_deliveries delivery
  set receipt_claimed_by = p_worker_id, receipt_lease_until = now() + p_lease,
      updated_at = now()
  from candidates
  where delivery.id = candidates.id
  returning delivery.id, delivery.provider_ticket_id;
end;
$$;

create or replace function public.notification_record_receipts(
  p_worker_id text,
  p_results jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_ticket_id text;
  v_state text;
  v_code text;
  v_token_id uuid;
  v_outbox_id uuid;
begin
  if jsonb_typeof(p_results) <> 'array' then raise exception 'Invalid receipt results'; end if;
  for v_result in select value from jsonb_array_elements(p_results)
  loop
    v_ticket_id := v_result ->> 'ticketId';
    v_state := v_result ->> 'state';
    v_code := coalesce(v_result ->> 'code', 'receipt_error');
    select token_id, outbox_id into v_token_id, v_outbox_id
    from private.notification_deliveries
    where provider_ticket_id = v_ticket_id and receipt_claimed_by = p_worker_id
      and receipt_lease_until >= now()
    for update;
    if not found then raise exception 'Receipt lease does not belong to worker'; end if;

    if v_state = 'delivered' then
      update private.notification_deliveries
      set status = 'delivered', delivered_at = now(), receipt_claimed_by = null,
          receipt_lease_until = null, last_error_code = null, updated_at = now()
      where provider_ticket_id = v_ticket_id;
    elsif v_state = 'permanent-failure' then
      update private.notification_deliveries
      set status = 'dead', receipt_attempts = least(receipt_attempts + 1, 5),
          receipt_claimed_by = null, receipt_lease_until = null,
          last_error_code = v_code, updated_at = now()
      where provider_ticket_id = v_ticket_id;
      if v_code = 'DeviceNotRegistered' then
        update private.notification_push_tokens
        set status = 'disabled', disabled_reason = 'device_not_registered',
            disabled_at = now(), last_seen_at = now()
        where id = v_token_id and status = 'active';
      end if;
    elsif v_state = 'transient-failure' then
      update private.notification_deliveries
      set status = case when receipt_attempts + 1 >= 5 then 'dead' else 'ticketed' end,
          receipt_attempts = least(receipt_attempts + 1, 5),
          receipt_available_at = now() + least(
            interval '1 hour', interval '1 minute' * power(2, receipt_attempts)
          ),
          receipt_claimed_by = null, receipt_lease_until = null,
          last_error_code = v_code, updated_at = now()
      where provider_ticket_id = v_ticket_id;
    else
      raise exception 'Invalid receipt result';
    end if;

    if not exists (
      select 1 from private.notification_deliveries
      where outbox_id = v_outbox_id and status = 'ticketed'
    ) then
      update private.notification_outbox
      set status = 'completed', completed_at = now(), updated_at = now()
      where id = v_outbox_id and status = 'awaiting_receipts';
    end if;
  end loop;
end;
$$;

revoke all on function public.register_push_token(text, uuid, text) from public, anon, authenticated;
grant execute on function public.register_push_token(text, uuid, text) to authenticated;
revoke all on function public.disable_push_installation(uuid, text) from public, anon, authenticated;
grant execute on function public.disable_push_installation(uuid, text) to authenticated;

revoke all on function public.notification_enqueue(text, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.notification_claim_outbox(text, integer, interval) from public, anon, authenticated;
grant execute on function public.notification_claim_outbox(text, integer, interval) to service_role;
revoke all on function public.notification_prepare_deliveries(uuid) from public, anon, authenticated;
revoke all on function public.notification_authorize_deliveries(uuid, text, uuid[]) from public, anon, authenticated;
revoke all on function public.notification_defer_without_provider(uuid, text) from public, anon, authenticated;
revoke all on function public.notification_record_tickets(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.notification_claim_receipts(text, integer, interval) from public, anon, authenticated;
revoke all on function public.notification_record_receipts(text, jsonb) from public, anon, authenticated;

grant execute on function public.notification_enqueue(text, uuid, text, jsonb) to service_role;
grant execute on function public.notification_prepare_deliveries(uuid) to service_role;
grant execute on function public.notification_authorize_deliveries(uuid, text, uuid[]) to service_role;
grant execute on function public.notification_defer_without_provider(uuid, text) to service_role;
grant execute on function public.notification_record_tickets(uuid, text, jsonb) to service_role;
grant execute on function public.notification_claim_receipts(text, integer, interval) to service_role;
grant execute on function public.notification_record_receipts(text, jsonb) to service_role;
