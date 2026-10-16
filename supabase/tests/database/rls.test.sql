begin;

create extension if not exists pgtap with schema extensions;

select plan(83);

select is((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), true, 'profiles has RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'public.body_photos'::regclass), true, 'body_photos has RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'public.garments'::regclass), true, 'garments has RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'public.usage_daily'::regclass), true, 'usage_daily has RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'public.tryon_jobs'::regclass), true, 'tryon_jobs has RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'public.ai_cost_ledger'::regclass), true, 'ai_cost_ledger has RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'public.analytics_events'::regclass), true, 'analytics_events has RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'storage.objects'::regclass), true, 'storage.objects has RLS enabled');

select is((select public from storage.buckets where id = 'body'), false, 'body bucket is private');
select is((select public from storage.buckets where id = 'garments'), false, 'garments bucket is private');
select is((select public from storage.buckets where id = 'results'), false, 'results bucket is private');

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000001', 'member-one@example.com'),
  ('00000000-0000-4000-8000-000000000002', 'member-two@example.com'),
  ('00000000-0000-4000-8000-000000000003', 'detached-member@example.com');

select has_table('private', 'marketplace_parties', 'marketplace parties use a private identity map');
select is(
  has_table_privilege('authenticated', 'private.marketplace_parties', 'select'),
  false,
  'members cannot read the marketplace party map'
);
select is(
  has_table_privilege('anon', 'private.marketplace_parties', 'select'),
  false,
  'anonymous clients cannot read the marketplace party map'
);

insert into public.marketplace_memberships (user_id, expires_at)
values
  ('00000000-0000-4000-8000-000000000001', now() + interval '1 year'),
  ('00000000-0000-4000-8000-000000000002', now() + interval '1 year'),
  ('00000000-0000-4000-8000-000000000003', now() + interval '1 year');

insert into public.marketplace_credit_accounts (user_id, available_balance)
values
  ('00000000-0000-4000-8000-000000000001', 100),
  ('00000000-0000-4000-8000-000000000002', 200),
  ('00000000-0000-4000-8000-000000000003', 300);

insert into public.marketplace_credit_ledger (
  user_id, kind, delta_available, idempotency_key, description
) values (
  '00000000-0000-4000-8000-000000000003',
  'adjustment',
  300,
  'detached-member-opening-balance',
  'Detachment fixture'
);

select is(
  (select count(*)
   from private.marketplace_parties
   where user_id in (
     '00000000-0000-4000-8000-000000000001',
     '00000000-0000-4000-8000-000000000002',
     '00000000-0000-4000-8000-000000000003'
   )),
  3::bigint,
  'one opaque marketplace party is created per participant'
);
select is(
  (select count(*)
   from public.marketplace_memberships membership
   join private.marketplace_parties party
     on party.id = membership.party_id and party.user_id = membership.user_id
   where membership.user_id in (
     '00000000-0000-4000-8000-000000000001',
     '00000000-0000-4000-8000-000000000002',
     '00000000-0000-4000-8000-000000000003'
   )),
  3::bigint,
  'legacy membership writes synchronize the party foreign key'
);
select is(
  (select count(*)
   from public.marketplace_credit_accounts account
   join private.marketplace_parties party
     on party.id = account.party_id and party.user_id = account.user_id
   where account.user_id in (
     '00000000-0000-4000-8000-000000000001',
     '00000000-0000-4000-8000-000000000002',
     '00000000-0000-4000-8000-000000000003'
   )),
  3::bigint,
  'legacy credit-account writes synchronize the party foreign key'
);
select throws_ok(
  $$insert into public.marketplace_credit_ledger (
      user_id, party_id, kind, delta_available, idempotency_key, description
    ) values (
      '00000000-0000-4000-8000-000000000002',
      (select id from private.marketplace_parties
       where user_id = '00000000-0000-4000-8000-000000000001'),
      'adjustment', 1, 'mismatched-party', 'Must fail'
    )$$,
  'P0001',
  'Marketplace party does not match the live profile',
  'a live profile cannot write against another marketplace party'
);

delete from public.profiles
where id = '00000000-0000-4000-8000-000000000003';

select is(
  (select count(*) from private.marketplace_parties where user_id is null),
  1::bigint,
  'profile deletion detaches rather than deletes the opaque party'
);
select is(
  (select count(*) from public.marketplace_memberships
   where user_id is null and party_id is not null),
  1::bigint,
  'detached marketplace membership retains only its party reference'
);
select is(
  (select count(*) from public.marketplace_credit_accounts
   where user_id is null and party_id is not null and available_balance = 300),
  1::bigint,
  'detached credit account remains reconcilable without a profile id'
);
select is(
  (select count(*) from public.marketplace_credit_ledger
   where user_id is null and party_id is not null
     and idempotency_key = 'detached-member-opening-balance'),
  1::bigint,
  'detached ledger history remains linked only to the opaque party'
);

insert into public.body_photos (id, user_id, storage_path, status)
values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001/body-one.jpg', 'approved'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002/body-two.jpg', 'approved');

insert into public.garments (id, user_id, original_path, clean_path, image_hash, name, category, status)
values
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001/garment-one.jpg', '00000000-0000-4000-8000-000000000001/garment-one-clean.png', 'hash-one', 'Jacket one', 'outerwear', 'ready'),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002/garment-two.jpg', '00000000-0000-4000-8000-000000000002/garment-two-clean.png', 'hash-two', 'Jacket two', 'outerwear', 'ready');

insert into public.usage_daily (user_id, day, tryon_count)
values
  ('00000000-0000-4000-8000-000000000001', current_date, 1),
  ('00000000-0000-4000-8000-000000000002', current_date, 2);

insert into public.tryon_jobs (id, user_id, body_photo_id, garment_id, cache_key, status, result_path)
values
  ('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'cache-one', 'done', '00000000-0000-4000-8000-000000000001/result-one.png'),
  ('30000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'cache-two', 'done', '00000000-0000-4000-8000-000000000002/result-two.png');

insert into public.ai_cost_ledger (user_id, kind, provider, cost_usd)
values
  ('00000000-0000-4000-8000-000000000001', 'tryon', 'test-provider', 0.01),
  ('00000000-0000-4000-8000-000000000002', 'tryon', 'test-provider', 0.02);

update public.profiles
set tier = 'pro',
    adult_confirmed_at = now()
where id = '00000000-0000-4000-8000-000000000001';

update public.profiles
set tier = 'pro'
where id = '00000000-0000-4000-8000-000000000002';

insert into public.body_photos (id, user_id, storage_path, status)
values (
  '10000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001/body-pending.jpg',
  'pending'
);

select throws_ok(
  $$insert into public.tryon_jobs (id, user_id, body_photo_id, garment_id, cache_key, status)
    values (
      '30000000-0000-4000-8000-000000000003',
      '00000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000003',
      '20000000-0000-4000-8000-000000000001',
      'pending-photo-cache',
      'queued'
    )$$,
  '23514',
  'Body photo must be approved.',
  'try-on jobs reject pending body photos'
);
select is(
  (public.claim_body_photo_validation(
    '10000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000001'
  ) ->> 'state'),
  'claimed',
  'service validation claims an owner pending photo'
);
select is(
  (public.claim_body_photo_validation(
    '10000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000001'
  ) ->> 'state'),
  'busy',
  'a concurrent validation cannot double-claim the photo'
);
select lives_ok(
  $$select public.complete_body_photo_validation(
    '10000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000001',
    1,
    'approved',
    null,
    'gemini-test',
    0.001
  )$$,
  'validation completion updates status and ledger atomically'
);
select results_eq(
  $$select status, reject_reason, (
      select count(*)
      from public.ai_cost_ledger
      where user_id = '00000000-0000-4000-8000-000000000001'
        and kind = 'moderation'
        and provider = 'gemini-test'
    )
    from public.body_photos
    where id = '10000000-0000-4000-8000-000000000003'$$,
  $$values ('approved'::text, null::text, 1::bigint)$$,
  'approved status has no rejection detail and one moderation cost entry'
);

insert into storage.objects (id, bucket_id, name)
values
  ('40000000-0000-4000-8000-000000000001', 'body', '00000000-0000-4000-8000-000000000001/body-one.jpg'),
  ('40000000-0000-4000-8000-000000000002', 'body', '00000000-0000-4000-8000-000000000002/body-two.jpg'),
  ('40000000-0000-4000-8000-000000000007', 'garments', '00000000-0000-4000-8000-000000000001/garment-one.jpg'),
  ('40000000-0000-4000-8000-000000000006', 'garments', '00000000-0000-4000-8000-000000000001/garment-one-clean.png'),
  ('40000000-0000-4000-8000-000000000008', 'garments', '00000000-0000-4000-8000-000000000001/unlisted.jpg');

insert into public.marketplace_listings (
  id, garment_id, seller_id, accepts_credits, accepts_swap, is_giveaway, credit_price, pickup_area
)
values (
  '50000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  true,
  false,
  false,
  100,
  'Test pickup area'
);

insert into public.marketplace_listings (
  id, garment_id, seller_id, accepts_credits, accepts_swap, is_giveaway, credit_price, pickup_area
)
values (
  '50000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000002',
  false,
  false,
  true,
  null,
  'Second pickup area'
);

insert into public.marketplace_offers (
  id, listing_id, buyer_id, seller_id, mode
) values (
  '60000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  'giveaway'
);

insert into public.marketplace_transactions (
  id, offer_id, listing_id, seller_id, buyer_id, mode
) values (
  '70000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000001',
  'giveaway'
);

select is(
  (select count(*)
   from public.marketplace_listings listing
   join private.marketplace_parties party
     on party.id = listing.seller_party_id and party.user_id = listing.seller_id
   where listing.id in (
     '50000000-0000-4000-8000-000000000001',
     '50000000-0000-4000-8000-000000000002'
   )),
  2::bigint,
  'legacy listing writes synchronize seller parties'
);
select is(
  (select count(*)
   from public.marketplace_offers offer_record
   join private.marketplace_parties buyer on buyer.id = offer_record.buyer_party_id
   join private.marketplace_parties seller on seller.id = offer_record.seller_party_id
   where buyer.user_id = offer_record.buyer_id
     and seller.user_id = offer_record.seller_id),
  1::bigint,
  'legacy offer writes synchronize both participant parties'
);
select is(
  (select count(*)
   from public.marketplace_transactions transaction_record
   join private.marketplace_parties buyer on buyer.id = transaction_record.buyer_party_id
   join private.marketplace_parties seller on seller.id = transaction_record.seller_party_id
   where buyer.user_id = transaction_record.buyer_id
     and seller.user_id = transaction_record.seller_id),
  1::bigint,
  'legacy transaction writes synchronize both participant parties'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);

select results_eq(
  $$select name from storage.objects
    where bucket_id = 'garments'
      and name in (
        '00000000-0000-4000-8000-000000000001/garment-one.jpg',
        '00000000-0000-4000-8000-000000000001/garment-one-clean.png',
        '00000000-0000-4000-8000-000000000001/unlisted.jpg'
      )
    order by name$$,
  $$values ('00000000-0000-4000-8000-000000000001/garment-one-clean.png'::text)$$,
  'a buyer reads only the cleaned image of another member active marketplace listing'
);

reset role;
update public.marketplace_listings
set status = 'withdrawn'
where id = '50000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);

select is_empty(
  $$select name from storage.objects
    where name = '00000000-0000-4000-8000-000000000001/garment-one-clean.png'$$,
  'a buyer cannot read the image after the marketplace listing is withdrawn'
);

reset role;
update public.marketplace_listings
set status = 'active'
where id = '50000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);

select throws_ok(
  $$insert into public.body_photos (id, user_id, storage_path, status)
    values (
      '10000000-0000-4000-8000-000000000004',
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000002/unconfirmed-body.jpg',
      'pending'
    )$$,
  '42501',
  'new row violates row-level security policy for table "body_photos"',
  'unconfirmed member cannot create a body photo record'
);
select throws_ok(
  $$insert into public.garments (id, user_id, original_path, name, category)
    values (
      '20000000-0000-4000-8000-000000000004',
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000002/unconfirmed-garment.jpg',
      'Unconfirmed garment',
      null
    )$$,
  '42501',
  'new row violates row-level security policy for table "garments"',
  'unconfirmed member cannot create a garment record'
);
select throws_ok(
  $$insert into storage.objects (id, bucket_id, name)
    values (
      '40000000-0000-4000-8000-000000000005',
      'body',
      '00000000-0000-4000-8000-000000000002/unconfirmed-body.jpg'
    )$$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'unconfirmed member cannot upload private source media'
);

reset role;
delete from public.body_photos where id = '10000000-0000-4000-8000-000000000004';
delete from public.garments where id = '20000000-0000-4000-8000-000000000004';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);

select results_eq('select count(*) from public.profiles', array[1::bigint], 'member sees only their profile');
select results_eq('select count(*) from public.body_photos', array[2::bigint], 'member sees only their body photos');
select results_eq('select count(*) from public.garments', array[1::bigint], 'member sees only their garments');
select results_eq('select count(*) from public.usage_daily', array[1::bigint], 'member sees only their usage');
select results_eq('select count(*) from public.tryon_jobs', array[1::bigint], 'member sees only their try-on jobs');
select results_eq(
  'select count(*) from public.marketplace_memberships',
  array[1::bigint],
  'member sees only their marketplace membership through the party mapping'
);
select results_eq(
  'select count(*) from public.marketplace_credit_accounts',
  array[1::bigint],
  'member sees only their marketplace credit account through the party mapping'
);
select results_eq(
  'select bool_and(public.marketplace_party_matches(party_id)) from public.marketplace_memberships',
  array[true],
  'the public helper reveals only whether a party belongs to the current member'
);
select is(
  (select count(*)::integer from public.marketplace_offers),
  1,
  'an offer participant can read their offer through party authorization'
);
select is(
  (select count(*)::integer from public.marketplace_transactions),
  1,
  'a transaction participant can read their transaction through party authorization'
);
select is(has_table_privilege('authenticated', 'public.ai_cost_ledger', 'select'), false, 'member cannot read the cost ledger');
select is(has_table_privilege('authenticated', 'public.analytics_events', 'select'), false, 'member cannot read analytics events');
select is(
  has_table_privilege('authenticated', 'public.analytics_events', 'insert'),
  false,
  'members cannot bypass the validated analytics ingress with direct inserts'
);
select lives_ok(
  $$select public.record_analytics_event('app_opened', '{"source":"launch"}')$$,
  'members can record an allowlisted event through server-validated ingress'
);
select throws_ok(
  $$select public.record_analytics_event('app_opened', '{"source":"secret-token"}')$$,
  '22023', 'Invalid analytics event properties',
  'server validation rejects sensitive-looking values from modified clients'
);
select throws_ok(
  $$select public.record_analytics_event('auth_signed_in', '{}'::jsonb)$$,
  '22023', 'Invalid analytics event properties',
  'server validation rejects an auth event without its required method'
);
select throws_ok(
  $$select public.record_analytics_event('garment_uploaded', '{}'::jsonb)$$,
  '22023', 'Invalid analytics event properties',
  'server validation rejects a garment event without its required category mode'
);
select throws_ok(
  $$select public.record_analytics_event('tryon_requested', '{}'::jsonb)$$,
  '22023', 'Invalid analytics event properties',
  'server validation rejects a try-on request without its required cache flag'
);
select throws_ok(
  $$select public.record_analytics_event('tryon_completed', '{}'::jsonb)$$,
  '22023', 'Invalid analytics event properties',
  'server validation rejects a try-on completion without its required provider'
);
select throws_ok(
  $$select public.record_analytics_event(
    'app_error',
    '{"name":"Error","operation":"render","fatal":false}'::jsonb
  )$$,
  '22023', 'Invalid analytics event properties',
  'server validation rejects a partial error event without its required code'
);

select results_eq(
  $$update public.profiles set display_name = 'Updated' where id = '00000000-0000-4000-8000-000000000001' returning id$$,
  $$values ('00000000-0000-4000-8000-000000000001'::uuid)$$,
  'member can update their allowed profile metadata'
);
select is_empty(
  $$update public.profiles set display_name = 'Blocked' where id = '00000000-0000-4000-8000-000000000002' returning id$$,
  'member cannot update another profile'
);
select results_eq(
  $$update public.garments set color = 'navy' where id = '20000000-0000-4000-8000-000000000001' returning id$$,
  $$values ('20000000-0000-4000-8000-000000000001'::uuid)$$,
  'member can update their garment metadata'
);
select is_empty(
  $$update public.garments set color = 'blocked' where id = '20000000-0000-4000-8000-000000000002' returning id$$,
  'member cannot update another garment'
);
select is_empty(
  $$delete from public.body_photos where id = '10000000-0000-4000-8000-000000000002' returning id$$,
  'member cannot delete another body photo'
);
select results_eq(
  $$update public.tryon_jobs set feedback = 1 where id = '30000000-0000-4000-8000-000000000001' returning id$$,
  $$values ('30000000-0000-4000-8000-000000000001'::uuid)$$,
  'member can rate their completed fitting'
);
select is_empty(
  $$update public.tryon_jobs set feedback = 1 where id = '30000000-0000-4000-8000-000000000002' returning id$$,
  'member cannot rate another fitting'
);

select lives_ok(
  $$insert into public.garments (id, user_id, original_path, name, category)
    values (
      '20000000-0000-4000-8000-000000000003',
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000001/auto-category.jpg',
      'Auto category garment',
      null
    )$$,
  'member can upload a garment for automatic category detection'
);

reset role;
select results_eq(
  $$select result ->> 'state', result -> 'garment' ->> 'category'
    from (select public.claim_garment_processing(
      '20000000-0000-4000-8000-000000000003',
      '00000000-0000-4000-8000-000000000001'
    ) as result) claimed$$,
  $$values ('claimed'::text, null::text)$$,
  'worker claims an auto-category garment without inventing a category'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$update public.garments
    set category = 'dress'
    where id = '20000000-0000-4000-8000-000000000003'$$,
  'member can choose a category while processing is in progress'
);

reset role;
select lives_ok(
  $$select public.complete_garment_processing(
    '20000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001/auto-category-clean.jpg',
    '0123456789abcdef',
    'original-image',
    0,
    'top',
    'gemini',
    0.001
  )$$,
  'worker completion preserves a member edit and records both processing costs'
);
select results_eq(
  $$select category, status, count(*) filter (where kind = 'bg_removal'),
      count(*) filter (where kind = 'garment_tagging')
    from public.garments
    join public.ai_cost_ledger on ai_cost_ledger.user_id = garments.user_id
    where garments.id = '20000000-0000-4000-8000-000000000003'
    group by category, status$$,
  $$values ('dress'::text, 'ready'::text, 1::bigint, 1::bigint)$$,
  'completion keeps the manual category and writes one cost entry per provider operation'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);

select results_eq(
  $$select count(*) from storage.objects
    where name in (
      '00000000-0000-4000-8000-000000000001/body-one.jpg',
      '00000000-0000-4000-8000-000000000001/garment-one.jpg',
      '00000000-0000-4000-8000-000000000001/garment-one-clean.png',
      '00000000-0000-4000-8000-000000000001/unlisted.jpg'
    )$$,
  array[4::bigint],
  'member sees every object in their private folder'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'private_image_delete' and cmd = 'DELETE'),
  1,
  'private objects have one explicit delete policy'
);
select ok(
  (select qual::text like '%auth.uid()%profiles%' from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'private_image_delete'),
  'private object deletion requires the owner and a live profile'
);
select lives_ok(
  $$insert into storage.objects (id, bucket_id, name) values ('40000000-0000-4000-8000-000000000003', 'body', '00000000-0000-4000-8000-000000000001/new-body.jpg')$$,
  'member can upload a source body image'
);
select throws_ok(
  $$insert into storage.objects (id, bucket_id, name) values ('40000000-0000-4000-8000-000000000004', 'results', '00000000-0000-4000-8000-000000000001/forged-result.png')$$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'member cannot upload a generated result'
);
select is_empty(
  $$update storage.objects set name = '00000000-0000-4000-8000-000000000001/renamed-body.jpg' where id = '40000000-0000-4000-8000-000000000003' returning id$$,
  'member cannot rewrite a private object'
);

reset role;
select is(has_table_privilege('service_role', 'public.profiles', 'select'), true, 'service role can read profiles for server administration');
select is(has_table_privilege('service_role', 'public.profiles', 'insert'), true, 'service role can seed profiles');
select is(has_table_privilege('service_role', 'public.garments', 'insert'), true, 'service role can seed garments');
select is(has_table_privilege('service_role', 'public.marketplace_memberships', 'insert'), true, 'service role can seed memberships');
select is(has_table_privilege('service_role', 'public.marketplace_credit_accounts', 'update'), true, 'service role can seed credit balances');
select is(has_table_privilege('service_role', 'public.marketplace_listings', 'insert'), true, 'service role can seed listings');

set local role anon;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000009', true);

select is(has_table_privilege('anon', 'public.profiles', 'select'), false, 'anonymous users cannot read profiles');
select is(has_table_privilege('anon', 'public.body_photos', 'select'), false, 'anonymous users cannot read body photos');
select is(has_table_privilege('anon', 'public.garments', 'select'), false, 'anonymous users cannot read garments');
select is(has_table_privilege('anon', 'public.analytics_events', 'insert'), false, 'anonymous users cannot insert analytics events');

reset role;
select * from finish();
rollback;
