# Marketplace acquired garments — TDD evidence

## Scope

C09 completes the physical handoff loop. Credit purchases, free give-aways and both directions of a swap now place recipient-owned garment copies in the correct private closets without reassigning the seller's garment row or Storage path.

## Red evidence

Commit `a1bfa79` defined the migration, database, Edge orchestration and app repository contracts before implementation. The focused run failed because the C09 migration and `confirm-marketplace-handoff` function did not exist, and because the app still called the legacy database confirmation RPC directly.

## Implemented contract

- The first participant confirmation records intent only. The second creates an idempotent private acquisition plan with one copy for credit/give-away or two reciprocal copies for a swap.
- A service-role Edge Function authenticates the caller, copies original and cleaned images into deterministic recipient-owned `garments` paths, and invokes finalization only after every expected object exists.
- Database finalization enters the listing and account-deletion lock hierarchy, verifies both confirmations and Storage evidence, inserts sanitized `ready` garment rows, settles credits, closes listings, archives source garments and marks immutable provenance in one transaction.
- Acquired rows copy only closet-safe descriptive fields. Image hashes, processing failures, provider details, source ownership and source paths are not reassigned.
- Copy and finalizer retries are idempotent. Partial Storage work is reused, while missing objects keep the transaction and value frozen for a safe retry.
- Completed acquisition reconciliation is service-only; private provenance is unavailable to clients and survives garment deletion with its direct garment reference cleared.

## Verification

- Four focused Jest suites cover the migration contract, Edge handler, copy orchestrator and app repository boundary.
- `supabase/tests/database/marketplace_acquired_garments.test.sql` contains 29 pgTAP assertions across credits, swaps, give-aways, missing media, sanitization, authorization, balances, retries and reconciliation.
- The isolated database harness runs two finalizers concurrently to prove one garment/one transfer pair, then crosses finalization with the account-deletion fence to prove no deadlock or post-tombstone recreation.
- The full quality gate and independent review remain required before merge.
