-- Replace the Phase 1 all-or-nothing account deletion path with a durable,
-- marketplace-aware tombstone. Final retention durations and legal-hold
-- release remain policy Gate B / C06; this migration records the policy
-- version without inventing a legal duration.

create table private.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null unique
    references private.marketplace_parties(id) on delete restrict,
  auth_user_id uuid unique,
  policy_version text not null default 'deletion-v1-gate-b-pending',
  status text not null default 'purging'
    check (status in ('purging', 'awaiting_auth_delete', 'completed')),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check (
    (status = 'completed' and completed_at is not null and auth_user_id is null)
    or (status <> 'completed' and completed_at is null and auth_user_id is not null)
  )
);

create table private.account_deletion_checkpoints (
  request_id uuid not null
    references private.account_deletion_requests(id) on delete restrict,
  step text not null check (step in (
    'tombstone', 'body', 'garments', 'results', 'database_purge', 'auth_delete'
  )),
  status text not null default 'pending'
    check (status in ('pending', 'completed')),
  attempts integer not null default 0 check (attempts >= 0),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (request_id, step),
  check (
    (status = 'completed' and completed_at is not null)
    or (status = 'pending' and completed_at is null)
  )
);

revoke all on private.account_deletion_requests from public, anon, authenticated;
revoke all on private.account_deletion_checkpoints from public, anon, authenticated;

-- Listing shells remain as non-personal transaction references. Their media
-- and pickup area are removable, while the opaque seller party remains.
alter table public.marketplace_listings
  alter column garment_id drop not null,
  add column deleted_at timestamptz;

alter table public.marketplace_messages
  drop constraint marketplace_messages_sender_id_fkey,
  alter column sender_id drop not null,
  add constraint marketplace_messages_sender_id_fkey
    foreign key (sender_id) references public.profiles(id) on delete set null;

create or replace function private.account_deletion_active_request(
  p_user_id uuid default null,
  p_party_id uuid default null
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select request.id
  from private.account_deletion_requests request
  where request.status in ('purging', 'awaiting_auth_delete')
    and (
      (p_user_id is not null and request.auth_user_id = p_user_id)
      or (p_party_id is not null and request.party_id = p_party_id)
    )
  limit 1;
$$;

-- Every personal-data writer and deletion start takes the same transaction lock.
-- A writer that arrived first must commit before the tombstone is created; a
-- writer that arrived second observes the tombstone and is rejected. Party
-- subjects are resolved to both their live Auth user and durable deletion
-- subject, and locks are sorted to avoid cross-party deadlocks.
create or replace function private.account_deletion_lock_subjects(
  p_user_ids uuid[] default '{}'::uuid[],
  p_party_ids uuid[] default '{}'::uuid[]
)
returns void
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
    perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 6042026));
  end loop;
end;
$$;

create or replace function public.account_deletion_write_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.account_deletion_active_request((select auth.uid()), null) is null;
$$;

create or replace function private.account_deletion_reject_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_argument text;
  v_column text;
  v_value text;
  v_request_id uuid;
  v_bypass_request_id text := current_setting('app.account_deletion_request_id', true);
  v_internal_cleanup boolean :=
    current_setting('app.account_deletion_internal_cleanup', true) = 'on';
  v_row jsonb := to_jsonb(new);
  v_user_ids uuid[] := '{}'::uuid[];
  v_party_ids uuid[] := '{}'::uuid[];
begin
  foreach v_argument in array tg_argv
  loop
    if v_argument like 'party:%' then
      v_column := substring(v_argument from 7);
      v_value := v_row ->> v_column;
      if v_value is not null and v_value <> '' then
        v_party_ids := array_append(v_party_ids, v_value::uuid);
      end if;
    elsif v_argument like 'user:%' then
      v_column := substring(v_argument from 6);
      v_value := v_row ->> v_column;
      if v_value is not null and v_value <> '' then
        v_user_ids := array_append(v_user_ids, v_value::uuid);
      end if;
    else
      raise exception 'Unsupported account deletion barrier argument';
    end if;
  end loop;

  perform private.account_deletion_lock_subjects(v_user_ids, v_party_ids);

  if v_internal_cleanup and exists (
    select 1 from private.account_deletion_requests request
    where request.id::text = v_bypass_request_id
      and request.status in ('purging', 'awaiting_auth_delete')
  ) then
    return new;
  end if;

  foreach v_argument in array tg_argv
  loop
    v_request_id := null;
    if v_argument like 'party:%' then
      v_column := substring(v_argument from 7);
      v_value := v_row ->> v_column;
      if v_value is not null and v_value <> '' then
        v_request_id := private.account_deletion_active_request(null, v_value::uuid);
      end if;
    elsif v_argument like 'user:%' then
      v_column := substring(v_argument from 6);
      v_value := v_row ->> v_column;
      if v_value is not null and v_value <> '' then
        v_request_id := private.account_deletion_active_request(v_value::uuid, null);
      end if;
    else
      raise exception 'Unsupported account deletion barrier argument';
    end if;

    if v_request_id is not null
       and v_bypass_request_id is distinct from v_request_id::text then
      raise exception 'Account deletion in progress';
    end if;
  end loop;

  return new;
end;
$$;

create or replace function private.account_deletion_reject_storage_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_segment text;
  v_request_id uuid;
  v_bypass_request_id text := current_setting('app.account_deletion_request_id', true);
begin
  if new.bucket_id not in ('body', 'garments', 'results') then return new; end if;
  v_user_segment := (storage.foldername(new.name))[1];
  if v_user_segment is null or v_user_segment !~*
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return new;
  end if;

  perform private.account_deletion_lock_subjects(
    array[v_user_segment::uuid], '{}'::uuid[]
  );
  v_request_id := private.account_deletion_active_request(v_user_segment::uuid, null);
  if v_request_id is not null
     and v_bypass_request_id is distinct from v_request_id::text then
    raise exception 'Account deletion in progress';
  end if;
  return new;
end;
$$;

create trigger account_deletion_write_barrier
before update on public.profiles
for each row execute function private.account_deletion_reject_write('user:id');

create trigger account_deletion_write_barrier
before insert or update on public.body_photos
for each row execute function private.account_deletion_reject_write('user:user_id');

create trigger account_deletion_write_barrier
before insert or update on public.garments
for each row execute function private.account_deletion_reject_write('user:user_id');

create trigger account_deletion_write_barrier
before insert or update on public.usage_daily
for each row execute function private.account_deletion_reject_write('user:user_id');

create trigger account_deletion_write_barrier
before insert or update on public.tryon_jobs
for each row execute function private.account_deletion_reject_write('user:user_id');

create trigger account_deletion_write_barrier
before insert or update on public.ai_cost_ledger
for each row execute function private.account_deletion_reject_write('user:user_id');

create trigger account_deletion_write_barrier
before insert or update on public.analytics_events
for each row execute function private.account_deletion_reject_write('user:user_id');

create trigger account_deletion_write_barrier
before insert or update on public.marketplace_memberships
for each row execute function private.account_deletion_reject_write(
  'user:user_id', 'party:party_id'
);

create trigger account_deletion_write_barrier
before insert or update on public.marketplace_credit_accounts
for each row execute function private.account_deletion_reject_write(
  'user:user_id', 'party:party_id'
);

create trigger account_deletion_write_barrier
before insert or update on public.marketplace_credit_ledger
for each row execute function private.account_deletion_reject_write(
  'user:user_id', 'party:party_id'
);

create trigger account_deletion_write_barrier
before insert or update on public.marketplace_listings
for each row execute function private.account_deletion_reject_write(
  'user:seller_id', 'party:seller_party_id'
);

create trigger account_deletion_write_barrier
before insert or update on public.marketplace_offers
for each row execute function private.account_deletion_reject_write(
  'user:buyer_id', 'user:seller_id',
  'party:buyer_party_id', 'party:seller_party_id'
);

create trigger account_deletion_write_barrier
before insert or update on public.marketplace_transactions
for each row execute function private.account_deletion_reject_write(
  'user:buyer_id', 'user:seller_id',
  'party:buyer_party_id', 'party:seller_party_id'
);

create trigger account_deletion_write_barrier
before insert or update on public.marketplace_messages
for each row execute function private.account_deletion_reject_write('user:sender_id');

create trigger account_deletion_write_barrier
before insert or update on private.marketplace_grant_cohorts
for each row execute function private.account_deletion_reject_write('party:party_id');

create trigger account_deletion_write_barrier
before insert or update on private.marketplace_ledger_accounts
for each row execute function private.account_deletion_reject_write('party:party_id');

create trigger account_deletion_write_barrier
before insert or update on private.marketplace_ledger_journals
for each row execute function private.account_deletion_reject_write('party:request_party_id');

create trigger account_deletion_storage_write_barrier
before insert or update of bucket_id, name on storage.objects
for each row execute function private.account_deletion_reject_storage_write();

drop policy if exists "private_source_image_insert" on storage.objects;
drop policy if exists "private_image_select" on storage.objects;
drop policy if exists "private_image_delete" on storage.objects;

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
);

create policy "private_image_select" on storage.objects for select to authenticated
using (
  bucket_id in ('body', 'garments', 'results')
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.profiles where id = (select auth.uid())
  )
  and public.account_deletion_write_allowed()
);

create policy "private_image_delete" on storage.objects for delete to authenticated
using (
  bucket_id in ('body', 'garments', 'results')
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.profiles where id = (select auth.uid())
  )
  and public.account_deletion_write_allowed()
);

create or replace function public.marketplace_can_read_garment_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.marketplace_listings listing
      join public.garments garment on garment.id = listing.garment_id
      where p_name = coalesce(garment.clean_path, garment.original_path)
        and private.account_deletion_active_request(
          null, listing.seller_party_id
        ) is null
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
  select
    transaction_record.id,
    transaction_record.listing_id,
    coalesce(garment.name,
      case when listing.deleted_at is not null then 'Deleted item' else 'Untitled piece' end),
    coalesce(garment.clean_path, garment.original_path),
    transaction_record.buyer_id,
    transaction_record.seller_id,
    transaction_record.mode,
    transaction_record.credit_amount,
    transaction_record.swap_listing_id,
    swap_garment.name,
    transaction_record.status,
    transaction_record.buyer_confirmed_at,
    transaction_record.seller_confirmed_at,
    transaction_record.completed_at,
    transaction_record.created_at
  from public.marketplace_transactions transaction_record
  join public.marketplace_listings listing on listing.id = transaction_record.listing_id
  left join public.garments garment on garment.id = listing.garment_id
  left join public.marketplace_listings swap_listing
    on swap_listing.id = transaction_record.swap_listing_id
  left join public.garments swap_garment on swap_garment.id = swap_listing.garment_id
  where public.marketplace_party_matches(transaction_record.buyer_party_id)
     or public.marketplace_party_matches(transaction_record.seller_party_id)
  order by transaction_record.created_at desc;
$$;

create or replace function public.account_deletion_start(p_user_id uuid)
returns table (request_id uuid, status text, completed_steps text[])
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request private.account_deletion_requests%rowtype;
  v_party_id uuid;
begin
  perform private.account_deletion_lock_subjects(array[p_user_id], '{}'::uuid[]);

  if p_user_id is null or not exists (
    select 1 from public.profiles where id = p_user_id
  ) then
    raise exception 'Account deletion subject not found';
  end if;

  v_party_id := private.marketplace_ensure_party(p_user_id);
  perform 1 from private.marketplace_parties where id = v_party_id for update;

  select * into v_request
  from private.account_deletion_requests
  where party_id = v_party_id;

  if found then
    return query
      select v_request.id, v_request.status,
        coalesce(array_agg(checkpoint.step order by checkpoint.step)
          filter (where checkpoint.status = 'completed'), '{}'::text[])
      from private.account_deletion_checkpoints checkpoint
      where checkpoint.request_id = v_request.id;
    return;
  end if;

  perform 1 from public.marketplace_listings
  where marketplace_listings.seller_party_id = v_party_id for update;
  perform 1 from public.marketplace_offers
  where marketplace_offers.buyer_party_id = v_party_id
    or marketplace_offers.seller_party_id = v_party_id for update;
  perform 1 from public.marketplace_transactions
  where marketplace_transactions.buyer_party_id = v_party_id
    or marketplace_transactions.seller_party_id = v_party_id for update;
  perform 1 from public.marketplace_credit_accounts
  where marketplace_credit_accounts.party_id = v_party_id for update;

  if exists (
      select 1 from public.marketplace_listings listing
      where listing.seller_party_id = v_party_id and listing.status = 'reserved'
    ) or exists (
      select 1 from public.marketplace_offers offer
      where (offer.buyer_party_id = v_party_id or offer.seller_party_id = v_party_id)
        and (
          offer.status = 'pending'
          or (
            offer.status = 'accepted'
            and not exists (
              select 1 from public.marketplace_transactions transaction_record
              where transaction_record.offer_id = offer.id
                and transaction_record.status in ('completed', 'cancelled')
            )
          )
        )
    ) or exists (
      select 1 from public.marketplace_transactions transaction_record
      where (
          transaction_record.buyer_party_id = v_party_id
          or transaction_record.seller_party_id = v_party_id
        )
        and transaction_record.status in ('awaiting_handoff', 'disputed')
    ) or exists (
      select 1 from public.marketplace_credit_accounts account
      where account.party_id = v_party_id and account.reserved_balance > 0
    ) then
    raise exception 'Account deletion blocked by unresolved marketplace activity';
  end if;

  insert into private.account_deletion_requests (party_id, auth_user_id)
  values (v_party_id, p_user_id)
  returning * into v_request;

  insert into private.account_deletion_checkpoints (
    request_id, step, status, attempts, completed_at
  )
  select
    v_request.id,
    step,
    case when step = 'tombstone' then 'completed' else 'pending' end,
    case when step = 'tombstone' then 1 else 0 end,
    case when step = 'tombstone' then now() else null end
  from unnest(array[
    'tombstone', 'body', 'garments', 'results', 'database_purge', 'auth_delete'
  ]) step;

  return query select v_request.id, v_request.status, array['tombstone']::text[];
end;
$$;

create or replace function public.account_deletion_mark_storage_step(
  p_request_id uuid,
  p_step text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_step not in ('body', 'garments', 'results') then
    raise exception 'Unsupported deletion storage checkpoint';
  end if;
  if not exists (
    select 1 from private.account_deletion_requests
    where id = p_request_id and status = 'purging'
  ) then
    raise exception 'Active account deletion request not found';
  end if;

  update private.account_deletion_checkpoints
  set status = 'completed',
      attempts = attempts + 1,
      completed_at = coalesce(completed_at, now()),
      updated_at = now()
  where request_id = p_request_id and step = p_step;
end;
$$;

create or replace function public.account_deletion_purge_database(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request private.account_deletion_requests%rowtype;
begin
  select * into v_request
  from private.account_deletion_requests
  where id = p_request_id
  for update;
  if not found then raise exception 'Account deletion request not found'; end if;
  if v_request.status = 'awaiting_auth_delete' then return; end if;
  if v_request.status <> 'purging' then
    raise exception 'Account deletion request is not purgeable';
  end if;
  if (
    select count(*) from private.account_deletion_checkpoints
    where request_id = p_request_id
      and step in ('body', 'garments', 'results')
      and status = 'completed'
  ) <> 3 then
    raise exception 'Private storage purge is incomplete';
  end if;

  if exists (
      select 1 from public.marketplace_listings
      where seller_party_id = v_request.party_id and status = 'reserved'
    ) or exists (
      select 1 from public.marketplace_offers
      where (buyer_party_id = v_request.party_id or seller_party_id = v_request.party_id)
        and (
          marketplace_offers.status = 'pending'
          or (
            marketplace_offers.status = 'accepted'
            and not exists (
              select 1 from public.marketplace_transactions transaction_record
              where transaction_record.offer_id = marketplace_offers.id
                and transaction_record.status in ('completed', 'cancelled')
            )
          )
        )
    ) or exists (
      select 1 from public.marketplace_transactions
      where (buyer_party_id = v_request.party_id or seller_party_id = v_request.party_id)
        and status in ('awaiting_handoff', 'disputed')
    ) or exists (
      select 1 from public.marketplace_credit_accounts
      where party_id = v_request.party_id and reserved_balance > 0
    ) then
    raise exception 'Account deletion blocked by unresolved marketplace activity';
  end if;

  perform set_config('app.account_deletion_request_id', p_request_id::text, true);
  perform set_config('app.account_deletion_internal_cleanup', 'on', true);

  delete from public.marketplace_messages
  where sender_id = v_request.auth_user_id;

  update public.marketplace_offers
  set message = null, updated_at = now()
  where buyer_party_id = v_request.party_id and message is not null;

  update public.marketplace_listings
  set garment_id = null,
      seller_id = null,
      pickup_area = 'Deleted account',
      status = case when status = 'completed' then status else 'withdrawn' end,
      deleted_at = coalesce(deleted_at, now()),
      updated_at = now()
  where seller_party_id = v_request.party_id;

  delete from public.tryon_jobs where user_id = v_request.auth_user_id;
  delete from public.body_photos where user_id = v_request.auth_user_id;
  delete from public.garments where user_id = v_request.auth_user_id;
  delete from public.usage_daily where user_id = v_request.auth_user_id;
  delete from public.ai_cost_ledger where user_id = v_request.auth_user_id;
  delete from public.analytics_events where user_id = v_request.auth_user_id;

  update private.account_deletion_checkpoints
  set status = 'completed', attempts = attempts + 1,
      completed_at = coalesce(completed_at, now()), updated_at = now()
  where request_id = p_request_id and step = 'database_purge';

  update private.account_deletion_requests
  set status = 'awaiting_auth_delete', updated_at = now()
  where id = p_request_id;
end;
$$;

create or replace function private.guard_account_deletion_before_auth_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_id uuid;
begin
  perform private.account_deletion_lock_subjects(array[old.id], '{}'::uuid[]);

  select request.id into v_request_id
  from private.account_deletion_requests request
  where request.auth_user_id = old.id
    and request.status = 'awaiting_auth_delete'
    and not exists (
      select 1
      from private.account_deletion_checkpoints checkpoint
      where checkpoint.request_id = request.id
        and checkpoint.step <> 'auth_delete'
        and checkpoint.status <> 'completed'
    )
  for update;

  if v_request_id is null then
    raise exception 'Account deletion purge is incomplete';
  end if;

  -- Auth deletion runs after the purge RPC has committed. Re-establish the
  -- narrowly validated request scope for ON DELETE cascades in this new
  -- transaction; otherwise their compatibility-column updates hit the write
  -- barrier for the same awaiting deletion request.
  perform set_config('app.account_deletion_request_id', v_request_id::text, true);
  perform set_config('app.account_deletion_internal_cleanup', 'on', true);

  return old;
end;
$$;

create or replace function private.complete_account_deletion_after_auth_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_id uuid;
begin
  select id into v_request_id
  from private.account_deletion_requests
  where auth_user_id = old.id and status = 'awaiting_auth_delete'
  for update;

  if v_request_id is not null then
    update private.account_deletion_checkpoints
    set status = 'completed', attempts = attempts + 1,
        completed_at = coalesce(completed_at, now()), updated_at = now()
    where request_id = v_request_id and step = 'auth_delete';

    update private.account_deletion_requests
    set status = 'completed', auth_user_id = null,
        completed_at = now(), updated_at = now()
    where id = v_request_id;
  end if;

  return old;
end;
$$;

create trigger guard_account_deletion_before_auth_delete
before delete on auth.users
for each row execute function private.guard_account_deletion_before_auth_delete();

create trigger complete_account_deletion_after_auth_delete
after delete on auth.users
for each row execute function private.complete_account_deletion_after_auth_delete();

revoke all on function private.account_deletion_active_request(uuid, uuid) from public, anon, authenticated;
revoke all on function private.account_deletion_lock_subjects(uuid[], uuid[]) from public, anon, authenticated;
revoke all on function private.account_deletion_reject_write() from public, anon, authenticated;
revoke all on function private.account_deletion_reject_storage_write() from public, anon, authenticated;
revoke all on function private.guard_account_deletion_before_auth_delete() from public, anon, authenticated;
revoke all on function private.complete_account_deletion_after_auth_delete() from public, anon, authenticated;
revoke all on function public.account_deletion_write_allowed() from public, anon;
revoke all on function public.account_deletion_start(uuid) from public, anon, authenticated;
revoke all on function public.account_deletion_mark_storage_step(uuid, text) from public, anon, authenticated;
revoke all on function public.account_deletion_purge_database(uuid) from public, anon, authenticated;

grant execute on function public.account_deletion_write_allowed() to authenticated;
grant execute on function public.account_deletion_start(uuid) to service_role;
grant execute on function public.account_deletion_mark_storage_step(uuid, text) to service_role;
grant execute on function public.account_deletion_purge_database(uuid) to service_role;
