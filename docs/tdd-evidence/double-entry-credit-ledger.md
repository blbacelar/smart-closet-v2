# C04 Double-Entry Credit Ledger — TDD Evidence

## Source and boundary

- Roadmap: `plans/app-completion-roadmap.md`, slice C04.
- GitHub authority: #48 and #73.
- This slice implements provider-neutral accounting. Final annual pricing,
  production grant quantities, lapse/refund economics, and store adapters remain
  external Gate A / C19-C20 decisions.

## User journeys

1. As a member, I can see only my own available, pending, and held credits plus
   the journal history relevant to me.
2. As the marketplace server, I can grant, reserve, release, settle, retire, or
   reverse credits exactly once while every journal remains balanced.
3. As an operator, I can reconcile the restricted double-entry ledger with the
   compatibility projection without exposing platform accounts to members.
4. As a migrating deployment, I can backfill legacy credit history and balances
   without losing value or relying on live public-profile identity.

## RED / GREEN report

| Stage | Command | Result | Evidence |
| --- | --- | --- | --- |
| Contract RED | `npm test -- --runInBand supabase/migrations/__tests__/doubleEntryCreditLedgerMigration.test.ts` | Expected FAIL, 4/4 | Migration file did not exist; test target compiled and executed. Checkpoint `9b0329f`. |
| Contract GREEN | same command | PASS, 4/4 | Restricted tables, balanced/immutable/idempotent contract, compatibility mirror, reconciliation, and privileges are present. |
| Legacy upgrade RED | `npm run test:db:upgrade` | Expected FAIL | Same-timestamp legacy rows exposed transient overdraft ordering; the migration-only replay path was isolated and reconciled to final balances. |
| Database GREEN | `npm run test:db:upgrade` | PASS | Legacy backfill 13/13; ledger behavior 43/43; two-connection concurrency 10/10; full RLS 77/77. |
| Concurrent retry RED | `npm run test:db:upgrade` | Expected FAIL | Two simultaneous calls with one idempotency key caused the waiter to validate the post-effect balance. Checkpoint `5e1e8e7`. |
| Concurrent retry GREEN | same command | PASS | The waiter rechecks journal/event ownership after account locks and returns the original journal. Fix checkpoint `31679ee`. |
| Independent review RED | contract test plus `npm run test:db:upgrade` | Expected FAIL | Review found reusable grant cohorts, unbound economic retry keys, unsupported multi-bucket legacy adjustments, a reversal retry race, and cache-only reconciliation. Regression checkpoint `85274ef`. |
| Independent review GREEN | same commands | PASS | Economic identity is validated on every retry path; cohort issuance is unique; every schema-valid legacy adjustment is balanced; reversal retries serialize; reconciliation derives from immutable postings. |

## Guarantees

| Guarantee | Test target | Type |
| --- | --- | --- |
| Every posted journal has at least two postings and sums to zero | `credit_ledger.test.sql` plus deferred balance trigger | Integration / pgTAP |
| Posted journals, postings, and cohort metadata cannot be mutated | `credit_ledger.test.sql` | Authorization / pgTAP |
| Raw member and platform accounts are not readable by clients | `credit_ledger.test.sql` | Authorization / pgTAP |
| Legacy balances/history backfill and reconcile without value loss | `marketplace-parties-backfill.test.sql`, `credit_ledger.test.sql` | Upgrade / pgTAP |
| Distinct concurrent reservations cannot overdraw a balance | `credit-ledger-concurrency.test.sql` with two simultaneous `psql` sessions | Concurrency / pgTAP verification |
| Concurrent identical retries create one journal and debit once | same concurrency harness | Concurrency / idempotency |
| Concurrent identical reversal retries create one reversal and restore once | same concurrency harness | Concurrency / idempotency |
| One external issuance event creates one journal and one grant cohort | `credit_ledger.test.sql` | Integration / pgTAP |
| Cohorts and retry keys are bound to the original party, operation, units, terms, and event | `credit_ledger.test.sql` | Integration / abuse regression |
| Available/reserved and mixed legacy adjustments migrate into balanced postings | `marketplace-parties-legacy.sql`, upgrade tests | Forward migration |
| Reconciliation compares compatibility and cache projections with immutable posting totals | `credit_ledger.test.sql` | Integrity / pgTAP |
| Authenticated history/balance projections contain only the caller's party | `credit_ledger.test.sql` | RLS boundary / pgTAP |

## Compatibility and rollback

- Existing `marketplace_credit_accounts` remains a synchronized projection for
  the current app during expand/contract migration.
- Existing `marketplace_credit_ledger` inserts mirror into the new ledger.
- Rollback is operational: disable new grants/reservations and retain read-only
  reconciliation. Corrections use forward migrations and immutable reversal
  journals; posted history is never rewritten.

## Known external gaps

- Gate A must approve the final cohort/refund/lapse policy before production
  paid grants are enabled.
- Provider event ingestion and membership lifecycle remain C19; state-machine
  settlement integration remains C07-C09.
