# Marketplace expiry worker — TDD evidence

## Scope

C08 enforces the offer and handoff deadlines established by C07. It releases stale reservations exactly once, reopens listings only when no participant has confirmed handoff, and freezes ambiguous physical-handoff cases for C15.

## Red evidence

Commit `b7d7c6d` added the static migration contract and 25 pgTAP assertions before the migration existed. The focused Jest suite failed because the worker migration, scan indexes, service-role entry point, explicit expiry ledger event, and cron schedule were absent.

The original static contract proposed `FOR UPDATE SKIP LOCKED` candidate claims. Lock-order analysis rejected that design before implementation because it would acquire row locks before C07's listing/deletion fences. The test was corrected to require bounded ordered reads, advisory fences, and row-lock revalidation instead.

Independent review then found two liveness gaps in the first green implementation: transaction advisory locks accumulated across differently ordered candidates, and one malformed row could abort and roll back the whole batch. Commit `58e2af7` added six pgTAP/static regression assertions before the repair; the focused suite failed until nonblocking gates, candidate isolation, and durable retry backoff were implemented.

## Implemented contract

- Partial indexes bound scans of pending offers and open handoffs.
- `public.marketplace_expire_stale` is executable only by `service_role`, validates its cutoff and batch size, and is scheduled once per minute.
- Overlapping cron invocations are serialized with a nonblocking worker gate; a losing invocation returns immediately.
- Listing and deletion gates use try-locks before `FOR UPDATE NOWAIT`, so the worker never waits while holding a partial lock set.
- Every candidate runs in an exception-isolated subtransaction. Busy or malformed candidates are recorded in `private.marketplace_expiry_failures` with capped exponential backoff, while later healthy candidates continue.
- Pending credit offers reuse the idempotent offer-release path.
- Unconfirmed credit handoffs write one immutable `expiration_release` event and atomically restore available/reserved balances.
- Unconfirmed swaps reopen both listings atomically.
- A handoff with either confirmation moves to `disputed`; it does not release credits or listings.
- Worker-owned `expired_at` timestamps are protected by triggers.
- Kill switches do not disable expiry or safe recovery.

## Verification

- `supabase/migrations/__tests__/marketplaceExpiryWorkerMigration.test.ts`: migration surface, lock hierarchy, idempotency, grants, and schedule.
- `supabase/tests/database/marketplace_expiry_worker.test.sql`: 31 deadline, state, balance, poison-row isolation, retry, authorization, and validation assertions.
- `scripts/test-marketplace-party-upgrade.js`: overlapping worker sessions prove exactly-once release; a deterministic crossed worker/writer lock-order race proves nonblocking deferral and eventual retry; the same isolated run also covers the complete legacy-upgrade, ledger, RLS, C07, and deletion suites.

The slice is complete only after the full quality gate, independent review, GitHub CI, and merge are green.
