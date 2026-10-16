# Marketplace state contract — TDD evidence

## Scope

C07 makes offer and transaction transitions, deadlines, accepted terms, and operational kill switches authoritative in PostgreSQL. It does not claim the C08 expiry worker or C09 acquired-garment transfer.

## Red evidence

The first commit added a static migration contract and pgTAP scenarios before the migration existed. They failed because the configuration switches, deadlines, immutable terms table, transition guards, and idempotent RPC behavior were absent.

A later committed concurrency scenario created two pending offers for one listing and accepted them in separate database sessions. Its first implementation exposed an inconsistent lock order: each session locked its offer before attempting the shared listing, while the winner also needed the losing offer to supersede it. The implementation was corrected to lock the shared listing set first, in deterministic UUID order, and then re-lock and revalidate the requested offer.

The upgrade fixture also proved that accepted legacy transactions require a terms snapshot. That missing backfill was added before immutable triggers are installed.

## Contract coverage

- `supabase/migrations/__tests__/marketplaceStateContractMigration.test.ts` checks the migration surface and recovery semantics.
- `supabase/tests/database/marketplace_state_contract.test.sql` exercises allowed and forbidden transitions, timestamp ownership, immutable terms, switch enforcement, retry behavior, and safe cancellation while paused.
- `supabase/upgrade-tests/marketplace-state-concurrency.test.sql` verifies the committed result of competing acceptance: one transaction, one accepted offer, one superseded offer, and one terms snapshot.
- `scripts/test-marketplace-party-upgrade.js` runs the competing acceptance in real concurrent `psql` sessions and then executes the deletion fence, account-deletion lifecycle, RLS, ledger, and legacy-upgrade suites against an isolated Supabase database.

## Verification gate

The slice is complete only after the focused tests, full `npm run quality`, independent review, GitHub CI, and merge are all green. C08 and C09 remain separate stories so C07 cannot hide an unimplemented worker or recipient-closet transfer behind schema completion.
