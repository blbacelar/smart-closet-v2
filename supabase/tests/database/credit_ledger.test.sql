begin;

create extension if not exists pgtap with schema extensions;

select plan(43);

select has_table('private', 'marketplace_grant_cohorts', 'grant cohorts are restricted records');
select has_table('private', 'marketplace_ledger_accounts', 'double-entry accounts exist');
select has_table('private', 'marketplace_ledger_journals', 'immutable journals exist');
select has_table('private', 'marketplace_ledger_postings', 'balanced postings exist');

select is(
  has_table_privilege('authenticated', 'private.marketplace_ledger_accounts', 'select'),
  false,
  'members cannot read raw member or platform accounts'
);
select is(
  has_table_privilege('authenticated', 'private.marketplace_ledger_journals', 'select'),
  false,
  'members cannot read raw journals'
);
select is(
  has_table_privilege('authenticated', 'private.marketplace_ledger_postings', 'select'),
  false,
  'members cannot read raw postings'
);
select is(
  has_function_privilege(
    'authenticated',
    'private.marketplace_post_credit_operation(uuid,text,bigint,text,text,text,uuid,jsonb,boolean,boolean)',
    'execute'
  ),
  false,
  'members cannot post credit operations'
);
select is(
  has_function_privilege(
    'service_role',
    'private.marketplace_post_credit_operation(uuid,text,bigint,text,text,text,uuid,jsonb,boolean,boolean)',
    'execute'
  ),
  true,
  'the server role can post approved credit operations'
);
select is(
  has_function_privilege('authenticated', 'public.marketplace_my_credit_balance()', 'execute'),
  true,
  'members can read their projected ledger balance'
);
select is(
  has_function_privilege('authenticated', 'public.marketplace_my_credit_history(integer)', 'execute'),
  true,
  'members can read their own journal history projection'
);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000010', 'ledger-one@example.com'),
  ('00000000-0000-4000-8000-000000000011', 'ledger-two@example.com');

insert into public.marketplace_credit_accounts (user_id, available_balance)
values
  ('00000000-0000-4000-8000-000000000010', 100),
  ('00000000-0000-4000-8000-000000000011', 40);

insert into public.marketplace_credit_ledger (
  user_id, kind, delta_available, idempotency_key, description
) values
  ('00000000-0000-4000-8000-000000000010', 'adjustment', 100, 'ledger-fixture-one', 'Opening fixture'),
  ('00000000-0000-4000-8000-000000000011', 'adjustment', 40, 'ledger-fixture-two', 'Opening fixture');

select is(
  (select count(*) from private.marketplace_ledger_journals
   where idempotency_key in ('legacy:ledger-fixture-one', 'legacy:ledger-fixture-two')),
  2::bigint,
  'legacy credit entries are mirrored exactly once'
);
select is(
  (select count(*) from (
    select journal.id
    from private.marketplace_ledger_journals journal
    join private.marketplace_ledger_postings posting on posting.journal_id = journal.id
    group by journal.id
    having sum(posting.units) <> 0
  ) imbalanced),
  0::bigint,
  'every migrated journal is balanced'
);
select is(
  (select count(*) from public.marketplace_reconcile_credit_ledger() where not balanced),
  0::bigint,
  'legacy projections reconcile after the initial mirror'
);

select isnt(
  private.marketplace_post_credit_operation(
    (select party_id from public.marketplace_credit_accounts
     where user_id = '00000000-0000-4000-8000-000000000010'),
    'reserve', 30, 'ledger-test-reserve', 'test-v1'
  ),
  null::uuid,
  'the server can reserve available credits'
);

select is(
  private.marketplace_post_credit_operation(
    (select party_id from public.marketplace_credit_accounts
     where user_id = '00000000-0000-4000-8000-000000000010'),
    'reserve', 30, 'ledger-test-reserve', 'test-v1'
  ),
  (select id from private.marketplace_ledger_journals
   where idempotency_key = 'ledger-test-reserve'),
  'replaying an idempotency key returns the original journal'
);
select is(
  (select count(*) from private.marketplace_ledger_journals
   where idempotency_key = 'ledger-test-reserve'),
  1::bigint,
  'an idempotency key creates one economic effect'
);
select is(
  (select available_balance from public.marketplace_credit_accounts
   where user_id = '00000000-0000-4000-8000-000000000010'),
  70,
  'reservation updates the compatibility available projection once'
);
select is(
  (select reserved_balance from public.marketplace_credit_accounts
   where user_id = '00000000-0000-4000-8000-000000000010'),
  30,
  'reservation updates the compatibility held projection once'
);

select throws_ok(
  $$select private.marketplace_post_credit_operation(
      (select party_id from public.marketplace_credit_accounts
       where user_id = '00000000-0000-4000-8000-000000000010'),
      'reserve', 80, 'ledger-test-overdraw', 'test-v1'
    )$$,
  'P0001',
  'Insufficient marketplace credit balance',
  'a reservation cannot overdraw available credits'
);
select results_eq(
  $$select available_balance, reserved_balance
    from public.marketplace_credit_accounts
    where user_id = '00000000-0000-4000-8000-000000000010'$$,
  $$values (70, 30)$$,
  'a rejected reservation leaves every projection unchanged'
);

select isnt(
  private.marketplace_post_credit_operation(
    (select party_id from public.marketplace_credit_accounts
     where user_id = '00000000-0000-4000-8000-000000000010'),
    'release', 10, 'ledger-test-release', 'test-v1'
  ),
  null::uuid,
  'the server can release held credits'
);
select isnt(
  private.marketplace_reverse_credit_journal(
    (select id from private.marketplace_ledger_journals
     where idempotency_key = 'ledger-test-release'),
    'ledger-test-release-reversal'
  ),
  null::uuid,
  'a posted journal is corrected through an immutable reversal'
);
select results_eq(
  $$select available_balance, reserved_balance
    from public.marketplace_credit_accounts
    where user_id = '00000000-0000-4000-8000-000000000010'$$,
  $$values (70, 30)$$,
  'reversal restores the compatibility projection exactly once'
);

select is(
  private.marketplace_post_credit_operation(
    (select party_id from public.marketplace_credit_accounts
     where user_id = '00000000-0000-4000-8000-000000000010'),
    'grant_available', 5, 'ledger-test-external-one', 'test-v1', 'provider-event-one'
  ),
  private.marketplace_post_credit_operation(
    (select party_id from public.marketplace_credit_accounts
     where user_id = '00000000-0000-4000-8000-000000000010'),
    'grant_available', 5, 'ledger-test-external-two', 'test-v1', 'provider-event-one'
  ),
  'one external event owns at most one journal across different retry keys'
);
select is(
  (select count(*) from private.marketplace_ledger_journals
   where external_event_key = 'provider-event-one'),
  1::bigint,
  'external event uniqueness prevents duplicate value creation'
);
select is(
  (select count(*) from private.marketplace_grant_cohorts
   where source_event_key = 'provider-event-one'),
  1::bigint,
  'a credit issuance event owns one immutable grant cohort'
);
select throws_ok(
  $$select private.marketplace_post_credit_operation(
      (select party_id from public.marketplace_credit_accounts
       where user_id = '00000000-0000-4000-8000-000000000010'),
      'grant_available', 5, 'ledger-test-cohort-reuse', 'test-v1', null,
      (select id from private.marketplace_grant_cohorts
       where source_event_key = 'provider-event-one')
    )$$,
  'P0001',
  'Grant cohort already issued',
  'one grant cohort cannot issue value twice under a new retry key'
);
select throws_ok(
  $$select private.marketplace_post_credit_operation(
      (select party_id from public.marketplace_credit_accounts
       where user_id = '00000000-0000-4000-8000-000000000011'),
      'grant_available', 5, 'ledger-test-wrong-cohort-party', 'test-v1', null,
      (select id from private.marketplace_grant_cohorts
       where source_event_key = 'provider-event-one')
    )$$,
  'P0001',
  'Grant cohort conflicts with the requested issuance',
  'a grant cohort cannot be issued to a different party'
);
select throws_ok(
  $$select private.marketplace_post_credit_operation(
      (select party_id from public.marketplace_credit_accounts
       where user_id = '00000000-0000-4000-8000-000000000010'),
      'reserve', 29, 'ledger-test-reserve', 'test-v1'
    )$$,
  'P0001',
  'Marketplace credit request conflicts with an existing idempotency or event key',
  'an idempotency key cannot be replayed with different economic terms'
);
select throws_ok(
  $$select private.marketplace_post_credit_operation(
      (select party_id from public.marketplace_credit_accounts
       where user_id = '00000000-0000-4000-8000-000000000011'),
      'grant_available', 5, 'ledger-test-event-wrong-owner', 'test-v1',
      'provider-event-one'
    )$$,
  'P0001',
  'Marketplace credit request conflicts with an existing idempotency or event key',
  'an external event cannot be replayed for a different party'
);
select throws_ok(
  $$select private.marketplace_post_credit_operation(
      (select party_id from public.marketplace_credit_accounts
       where user_id = '00000000-0000-4000-8000-000000000010'),
      'grant_available', 5, 'ledger-test-reserve', 'test-v1',
      'provider-event-one'
    )$$,
  'P0001',
  'Marketplace credit request conflicts with an existing idempotency or event key',
  'crossed idempotency and event keys cannot select an arbitrary journal'
);
select throws_ok(
  $$select private.marketplace_reverse_credit_journal(
      (select id from private.marketplace_ledger_journals
       where idempotency_key = 'ledger-test-reserve'),
      'ledger-test-release'
    )$$,
  'P0001',
  'Marketplace reversal request conflicts with an existing idempotency key',
  'a reversal key cannot resolve to a non-reversal journal'
);
select is(
  (select count(*) from public.marketplace_reconcile_credit_ledger() where not balanced),
  0::bigint,
  'new server operations preserve compatibility reconciliation'
);

update private.marketplace_ledger_accounts
set balance = balance + 1
where party_id = (
    select party_id from public.marketplace_credit_accounts
    where user_id = '00000000-0000-4000-8000-000000000010'
  )
  and kind = 'member_available';
update public.marketplace_credit_accounts
set available_balance = available_balance + 1
where user_id = '00000000-0000-4000-8000-000000000010';
select is(
  (select balanced from public.marketplace_reconcile_credit_ledger()
   where party_id = (
     select party_id from public.marketplace_credit_accounts
     where user_id = '00000000-0000-4000-8000-000000000010'
   )),
  false,
  'reconciliation detects matching cache drift by deriving truth from postings'
);
update private.marketplace_ledger_accounts
set balance = balance - 1
where party_id = (
    select party_id from public.marketplace_credit_accounts
    where user_id = '00000000-0000-4000-8000-000000000010'
  )
  and kind = 'member_available';
update public.marketplace_credit_accounts
set available_balance = available_balance - 1
where user_id = '00000000-0000-4000-8000-000000000010';
select is(
  (select balanced from public.marketplace_reconcile_credit_ledger()
   where party_id = (
     select party_id from public.marketplace_credit_accounts
     where user_id = '00000000-0000-4000-8000-000000000010'
   )),
  true,
  'reconciliation returns to balanced after cache repair'
);

select throws_ok(
  $$update private.marketplace_ledger_journals
    set kind = 'tampered'
    where idempotency_key = 'ledger-test-reserve'$$,
  'P0001',
  'Posted marketplace ledger records are immutable',
  'posted journals cannot be edited'
);
select throws_ok(
  $$delete from private.marketplace_ledger_postings
    where journal_id = (
      select id from private.marketplace_ledger_journals
      where idempotency_key = 'ledger-test-reserve'
    )$$,
  'P0001',
  'Posted marketplace ledger records are immutable',
  'posted postings cannot be deleted'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000010', true);

select results_eq(
  $$select pending_credits, available_credits, held_credits
    from public.marketplace_my_credit_balance()$$,
  $$values (0::bigint, 75::bigint, 30::bigint)$$,
  'a member sees only their current credit buckets'
);
select is(
  (select count(*) from public.marketplace_my_credit_history(100)),
  5::bigint,
  'a member sees only journals involving their party'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000011', true);

select results_eq(
  $$select pending_credits, available_credits, held_credits
    from public.marketplace_my_credit_balance()$$,
  $$values (0::bigint, 40::bigint, 0::bigint)$$,
  'another member cannot observe the first member balance'
);
select is(
  (select count(*) from public.marketplace_my_credit_history(100)),
  1::bigint,
  'another member cannot observe the first member journal history'
);

reset role;
select is(
  (select count(*) from (
    select journal.id
    from private.marketplace_ledger_journals journal
    join private.marketplace_ledger_postings posting on posting.journal_id = journal.id
    group by journal.id
    having sum(posting.units) <> 0
  ) imbalanced),
  0::bigint,
  'all grant, reserve, release, and reversal journals remain balanced'
);

select * from finish();
rollback;
