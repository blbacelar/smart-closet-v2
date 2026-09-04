begin;

create extension if not exists pgtap with schema extensions;

select plan(32);

select is((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), true, 'profiles has RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'public.body_photos'::regclass), true, 'body_photos has RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'public.garments'::regclass), true, 'garments has RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'public.usage_daily'::regclass), true, 'usage_daily has RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'public.tryon_jobs'::regclass), true, 'tryon_jobs has RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'public.ai_cost_ledger'::regclass), true, 'ai_cost_ledger has RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'storage.objects'::regclass), true, 'storage.objects has RLS enabled');

select is((select public from storage.buckets where id = 'body'), false, 'body bucket is private');
select is((select public from storage.buckets where id = 'garments'), false, 'garments bucket is private');
select is((select public from storage.buckets where id = 'results'), false, 'results bucket is private');

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000001', 'member-one@example.com'),
  ('00000000-0000-4000-8000-000000000002', 'member-two@example.com');

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

insert into storage.objects (id, bucket_id, name)
values
  ('40000000-0000-4000-8000-000000000001', 'body', '00000000-0000-4000-8000-000000000001/body-one.jpg'),
  ('40000000-0000-4000-8000-000000000002', 'body', '00000000-0000-4000-8000-000000000002/body-two.jpg');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);

select results_eq('select count(*) from public.profiles', array[1::bigint], 'member sees only their profile');
select results_eq('select count(*) from public.body_photos', array[1::bigint], 'member sees only their body photos');
select results_eq('select count(*) from public.garments', array[1::bigint], 'member sees only their garments');
select results_eq('select count(*) from public.usage_daily', array[1::bigint], 'member sees only their usage');
select results_eq('select count(*) from public.tryon_jobs', array[1::bigint], 'member sees only their try-on jobs');
select is(has_table_privilege('authenticated', 'public.ai_cost_ledger', 'select'), false, 'member cannot read the cost ledger');

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

select results_eq('select count(*) from storage.objects', array[1::bigint], 'member sees only their private objects');
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
set local role anon;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000009', true);

select is(has_table_privilege('anon', 'public.profiles', 'select'), false, 'anonymous users cannot read profiles');
select is(has_table_privilege('anon', 'public.body_photos', 'select'), false, 'anonymous users cannot read body photos');
select is(has_table_privilege('anon', 'public.garments', 'select'), false, 'anonymous users cannot read garments');

reset role;
select * from finish();
rollback;
