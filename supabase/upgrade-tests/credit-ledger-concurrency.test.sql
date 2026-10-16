begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

select is(
  (select count(*) from private.marketplace_ledger_journals
   where idempotency_key in ('ledger-race-one', 'ledger-race-two')),
  1::bigint,
  'only one concurrent reservation creates an economic effect'
);
select results_eq(
  $$select available_balance, reserved_balance
    from public.marketplace_credit_accounts
    where user_id = '00000000-0000-4000-8000-000000000012'$$,
  $$values (20, 80)$$,
  'concurrent reservation attempts cannot overdraw the compatibility balance'
);
select results_eq(
  $$select balanced from public.marketplace_reconcile_credit_ledger()
    where party_id = (
      select party_id from public.marketplace_credit_accounts
      where user_id = '00000000-0000-4000-8000-000000000012'
    )$$,
  $$values (true)$$,
  'the winning reservation remains reconciled with its compatibility projection'
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
  'the concurrent journal and all prior journals remain balanced'
);

select * from finish();
rollback;
