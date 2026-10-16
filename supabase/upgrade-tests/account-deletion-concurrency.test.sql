begin;

create extension if not exists pgtap with schema extensions;

select plan(3);

select is(
  (select count(*) from private.account_deletion_requests
   where auth_user_id = '00000000-0000-4000-8000-000000000023'
     and status = 'purging'),
  1::bigint,
  'the deletion tombstone commits after the held write transaction'
);
select is(
  (select count(*) from storage.objects
   where id = '60000000-0000-4000-8000-000000000023'),
  1::bigint,
  'the pre-tombstone storage write is visible to the purge enumerator'
);
select is(
  (select count(*) from storage.objects
   where id = '60000000-0000-4000-8000-000000000123'),
  0::bigint,
  'a post-tombstone storage write is rejected'
);

select * from finish();
rollback;
