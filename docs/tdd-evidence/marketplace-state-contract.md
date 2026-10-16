# Marketplace state contract — TDD evidence

## Scope

C07 makes offer and transaction transitions, deadlines, accepted terms, and operational kill switches authoritative in PostgreSQL. It does not claim the C08 expiry worker or C09 acquired-garment transfer.

## Red evidence

The first commit added a static migration contract and pgTAP scenarios before the migration existed. They failed because the configuration switches, deadlines, immutable terms table, transition guards, and idempotent RPC behavior were absent.

A later committed concurrency scenario created two pending offers for one listing and accepted them in separate database sessions. Its first implementation exposed an inconsistent lock order: each session locked its offer before attempting the shared listing, while the winner also needed the losing offer to supersede it. The implementation was corrected to lock the shared listing set first, in deterministic UUID order, and then re-lock and revalidate the requested offer.

The upgrade fixture also proved that accepted legacy transactions require a terms snapshot. That missing backfill was added before immutable triggers are installed.

## Independent review cycle

The first independent review rejected the slice and identified six untested boundaries. Each became regression evidence before the implementation changed:

- cancellation is rejected after either participant records the first handoff confirmation;
- an `expired` transaction resolves its accepted offer for both deletion start and the purge recheck;
- offer acceptance enters the deletion advisory fence before locking listings;
- reciprocal swap creation locks both listings in deterministic UUID order;
- legacy snapshots use `legacy-pre-c07` and leave unrecoverable listing flags unknown;
- identical offer retries return the pending offer, while a changed mode, swap listing, or message conflicts.

The same audit exposed a transaction-local deletion-cleanup bypass that remained enabled after database purge. The replacement purge function now clears both internal settings before returning. Confirmation and cancellation also enter the deletion fence before transaction row locks, matching the corrected offer paths.

The second independent review found two remaining release blockers. The legacy publish, listing-withdrawal, and offer-withdrawal RPCs still acquired row locks before the deletion fence; and the generic transaction trigger allowed a privileged writer to resolve `disputed` work without the future C15 atomic resolver. Regression tests reproduced both issues. The legacy RPCs now enter the deletion fence before row locks, and disputed transactions remain frozen. A listing-scoped advisory gate also stabilizes the participant set across create, accept, and withdrawal races without reintroducing crossed-swap deadlocks.

During verification, database lint caught an invalid `distinct` ordering expression in the new advisory helper, and the first concurrency harness run exposed nondeterministic process startup. The helper now orders directly by UUID, and the harness explicitly establishes the deletion lock before releasing the competing writer. The complete isolated database run then passed.

## Contract coverage

- `supabase/migrations/__tests__/marketplaceStateContractMigration.test.ts` checks the migration surface and recovery semantics.
- `supabase/tests/database/marketplace_state_contract.test.sql` exercises allowed and forbidden transitions, timestamp ownership, immutable terms, switch enforcement, retry behavior, and safe cancellation while paused.
- `supabase/upgrade-tests/marketplace-state-concurrency.test.sql` verifies the committed result of competing acceptance: one transaction, one accepted offer, one superseded offer, and one terms snapshot.
- `scripts/test-marketplace-party-upgrade.js` runs the competing acceptance in real concurrent `psql` sessions and then executes the deletion fence, account-deletion lifecycle, RLS, ledger, and legacy-upgrade suites against an isolated Supabase database.
- The same harness runs acceptance against a deletion session that deliberately holds the advisory lock before requesting listing rows, plus two reciprocal swap offers created from separate sessions. Deadlock output is a hard failure.
- The harness also races legacy publication, listing withdrawal, and offer withdrawal against account deletion. It asserts the expected winner, tombstone behavior, and absence of deadlocks in separate database sessions.

## Verification gate

The slice is complete only after the focused tests, full `npm run quality`, independent review, GitHub CI, and merge are all green. C08 and C09 remain separate stories so C07 cannot hide an unimplemented worker or recipient-closet transfer behind schema completion.
