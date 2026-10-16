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
| Review RED | focused Jest plus `npm run test:db:upgrade` | Expected FAIL | Independent review found an upload/tombstone serialization race, an Auth-delete bypass, missing analytics cleanup, unsafe retained-history projection, and dual-deletion interference. Regression checkpoint `2e26e52`. |
| Review GREEN | `node scripts/test-marketplace-party-upgrade.js` | PASS | Legacy upgrade 15/15; ledger 43/43; credit concurrency 10/10; two-connection deletion fence 3/3; deletion lifecycle 30/30; RLS 77/77; DB lint clean. |

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
| An upload already in flight commits before deletion starts, while later uploads fail | interactive two-connection deletion-fence harness and 3/3 pgTAP assertions |
| Auth deletion cannot bypass private Storage/database checkpoints | BEFORE DELETE guard pgTAP assertion |
| Analytics events cannot be recreated and are explicitly purged | lifecycle write-barrier and purge assertions |
| A surviving counterparty retains a redacted completed-transaction projection | nullable/party-based history RPC assertion |
| Two deleting counterparties can purge shared terminal rows without blocking each other | dual-deletion lifecycle assertions |

## Rollback

Disable new deletion starts, allow already-started requests to resume, and use a
forward migration for corrections. Never reattach a completed party to deleted
private content or rewrite retained journal history.
