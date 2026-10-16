# C05 Marketplace-Aware Account Deletion — TDD Evidence

## Source and boundary

- Roadmap slice: C05.
- GitHub authority: #48 and #75.
- Architecture: ADR-0002.
- C05 removes private content and establishes the tombstone/write boundary.
  Gate B and C06 still own final retention durations, legal holds, scheduled
  destruction, and backup restore/re-deletion.

## RED / GREEN report

| Stage | Command | Result | Evidence |
| --- | --- | --- | --- |
| Contract RED | `npm test -- --runInBand supabase/migrations/__tests__/marketplaceAccountDeletionMigration.test.ts supabase/functions/delete-account/__tests__/deleteAccount.test.ts supabase/functions/delete-account/__tests__/handler.test.ts` | Expected FAIL | Migration, durable orchestration, resumability, and marketplace conflict behavior were absent. Checkpoint `336f658`. |
| Contract GREEN | same command | PASS, 17/17 | Tombstone contract and Edge orchestration implemented. |
| Database RED 1 | `npm run test:db:upgrade` | Expected FAIL | Current adult-media Storage policy names exposed an obsolete policy assumption. |
| Database RED 2 | same command | Expected FAIL | A deliberately unjournaled reserved-balance fixture correctly failed reconciliation; fixture replaced with balanced opening/reservation evidence. |
| Database GREEN | same command | PASS | Legacy upgrade 15/15; ledger 43/43; concurrency 10/10; deletion lifecycle 25/25; RLS 77/77; DB lint clean. |

## Guarantees

| Guarantee | Evidence |
| --- | --- |
| Start is idempotent and blocked activity creates no tombstone | `account_deletion_lifecycle.test.sql` |
| Member, AI worker, and credit-event writes fail after tombstone | write-barrier pgTAP tests |
| Storage buckets and database purge resume from durable checkpoints | Edge orchestrator unit tests |
| Private metadata, garments, try-ons, authored messages, listing location, and media links are removed | lifecycle pgTAP tests |
| Auth deletion atomically completes the request and clears the live Auth UUID | auth trigger pgTAP test |
| Retained accounting stays balanced and uses only the opaque party | reconciliation pgTAP test |
| Members cannot read tombstones or invoke service orchestration | privilege pgTAP tests |

## Rollback

Disable new deletion starts, allow already-started requests to resume, and use a
forward migration for corrections. Never reattach a completed party to deleted
private content or rewrite retained journal history.
