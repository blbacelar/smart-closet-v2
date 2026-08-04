create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  region text default 'lower-mainland-bc',
  tier text not null default 'free' check (tier in ('free', 'pro')),
  created_at timestamptz not null default now()
);

create table public.body_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason text,
  created_at timestamptz not null default now()
);

create table public.garments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  original_path text not null,
  clean_path text,
  image_hash text,
  name text,
  category text check (category in ('top', 'bottom', 'dress', 'outerwear', 'shoes')),
  color text,
  size text,
  season text,
  status text not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  created_at timestamptz not null default now()
);

create table public.usage_daily (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null default current_date,
  tryon_count integer not null default 0 check (tryon_count >= 0),
  primary key (user_id, day)
);

create table public.tryon_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  body_photo_id uuid not null references public.body_photos(id) on delete cascade,
  garment_id uuid not null references public.garments(id) on delete cascade,
  cache_key text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  result_path text,
  provider text,
  provider_job_id text,
  cost_usd numeric(8,4),
  latency_ms integer,
  feedback smallint check (feedback in (-1, 1)),
  created_at timestamptz not null default now()
);

create index tryon_jobs_cache_key_idx on public.tryon_jobs(cache_key);
create index tryon_jobs_user_created_idx on public.tryon_jobs(user_id, created_at desc);
create index garments_user_created_idx on public.garments(user_id, created_at desc);

create table public.ai_cost_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('tryon', 'bg_removal', 'moderation')),
  provider text not null,
  cost_usd numeric(8,4) not null check (cost_usd >= 0),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.body_photos enable row level security;
alter table public.garments enable row level security;
alter table public.usage_daily enable row level security;
alter table public.tryon_jobs enable row level security;
alter table public.ai_cost_ledger enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "body_photos_own_all" on public.body_photos for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "garments_own_all" on public.garments for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "usage_select_own" on public.usage_daily for select to authenticated using ((select auth.uid()) = user_id);
create policy "tryon_jobs_select_own" on public.tryon_jobs for select to authenticated using ((select auth.uid()) = user_id);
create policy "tryon_jobs_feedback_own" on public.tryon_jobs for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure private.handle_new_user();

insert into storage.buckets (id, name, public)
values ('body', 'body', false), ('garments', 'garments', false), ('results', 'results', false)
on conflict (id) do update set public = excluded.public;

create policy "private_image_insert" on storage.objects for insert to authenticated
with check (
  bucket_id in ('body', 'garments', 'results')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "private_image_select" on storage.objects for select to authenticated
using (
  bucket_id in ('body', 'garments', 'results')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "private_image_update" on storage.objects for update to authenticated
using (
  bucket_id in ('body', 'garments', 'results')
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id in ('body', 'garments', 'results')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "private_image_delete" on storage.objects for delete to authenticated
using (
  bucket_id in ('body', 'garments', 'results')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
