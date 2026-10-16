-- Let authenticated marketplace members read the private garment image for an
-- active listing. The previous Storage policy joined public.garments as the
-- caller, so garment-owner RLS made the policy succeed only for the seller.
--
-- The helper remains bound to auth.uid(), bypasses table RLS only for this
-- boolean decision, and is executable only by authenticated members.

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
      from public.marketplace_listings l
      join public.garments g on g.id = l.garment_id
      where p_name = coalesce(g.clean_path, g.original_path)
        and (
          l.status = 'active'
          or exists (
            select 1
            from public.marketplace_transactions t
            where (t.listing_id = l.id or t.swap_listing_id = l.id)
              and (t.buyer_id = (select auth.uid()) or t.seller_id = (select auth.uid()))
          )
        )
    );
$$;

revoke all on function public.marketplace_can_read_garment_object(text) from public, anon;
grant execute on function public.marketplace_can_read_garment_object(text) to authenticated;

drop policy if exists "listed_garment_images_authenticated" on storage.objects;

create policy "listed_garment_images_authenticated"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'garments'
  and public.marketplace_can_read_garment_object(name)
);
