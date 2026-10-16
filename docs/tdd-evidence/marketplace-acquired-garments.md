# Marketplace acquired garments — TDD evidence

## Scope

C09 completes the physical handoff loop. Credit purchases, free give-aways and both directions of a swap now place recipient-owned garment copies in the correct private closets without reassigning the seller's garment row or Storage path.

## Red evidence

Commit `a1bfa79` defined the migration, database, Edge orchestration and app repository contracts before implementation. The focused run failed because the C09 migration and `confirm-marketplace-handoff` function did not exist, and because the app still called the legacy database confirmation RPC directly.

Independent review then found three P1 boundary races. Commit `bc0364b` added regression tests before the fixes: the expiry worker could dispute a fully confirmed handoff while Storage copied, both private original and cleaned assets crossed ownership, and a seller could delete the source object during a non-terminal exchange. The focused RED run failed 6 of 12 assertions for those exact missing guarantees.

## Implemented contract

- The first participant confirmation records intent only. The second creates an idempotent private acquisition plan with one copy for credit/give-away or two reciprocal copies for a swap.
- A service-role Edge Function authenticates the caller, selects exactly one marketplace-safe image (`clean_path`, with `original_path` only as fallback), copies it into a deterministic recipient-owned `garments` path, and invokes finalization only after every expected object exists.
- Database finalization enters the listing and account-deletion lock hierarchy, verifies both confirmations and Storage evidence, inserts sanitized `ready` garment rows, settles credits, closes listings, archives source garments and marks immutable provenance in one transaction.
- Acquisition plans form a durable settlement fence. The expiry worker defers rather than disputing them, and successful finalization clears any private expiry backoff record.
- Authenticated owners cannot delete a garment object while its listing is active/reserved or its transaction is awaiting handoff/disputed. Service-role account deletion keeps its deliberate RLS bypass.
- Acquired rows copy only closet-safe descriptive fields. Image hashes, processing failures, provider details, source ownership and source paths are not reassigned.
- Copy and finalizer retries are idempotent. Partial Storage work is reused, while missing objects keep the transaction and value frozen for a safe retry.
- Completed acquisition reconciliation is service-only; private provenance is unavailable to clients and survives garment deletion with its direct garment reference cleared.

## Verification

- Four focused Jest suites cover the migration contract, Edge handler, copy orchestrator and app repository boundary.
- `supabase/tests/database/marketplace_acquired_garments.test.sql` contains 36 pgTAP assertions across credits, swaps, give-aways, safe-media selection, source deletion authorization, expiry fencing, missing media, sanitization, balances, retries and reconciliation.
- The isolated database harness races two finalizers with the expiry worker to prove one garment/one transfer pair and no disputed settlement, then crosses finalization with the account-deletion fence to prove no deadlock or post-tombstone recreation.
- Focused GREEN evidence: 15/15 Jest assertions plus all 36 C09 pgTAP assertions and the complete isolated upgrade/concurrency harness passed.
- The full quality gate and second independent review remain required before merge.
