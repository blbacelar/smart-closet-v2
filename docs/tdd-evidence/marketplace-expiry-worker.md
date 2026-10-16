# Marketplace expiry worker — TDD evidence

## Scope

C08 enforces the offer and handoff deadlines established by C07. It releases stale reservations exactly once, reopens listings only when no participant has confirmed handoff, and freezes ambiguous physical-handoff cases for C15.

## Red evidence

Commit `b7d7c6d` added the static migration contract and 25 pgTAP assertions before the migration existed. The focused Jest suite failed because the worker migration, scan indexes, service-role entry point, explicit expiry ledger event, and cron schedule were absent.

The original static contract proposed `FOR UPDATE SKIP LOCKED` candidate claims. Lock-order analysis rejected that design before implementation because it would acquire row locks before C07's listing/deletion fences. The test was corrected to require bounded ordered reads, advisory fences, and row-lock revalidation instead.

## Implemented contract

- Partial indexes bound scans of pending offers and open handoffs.
- `public.marketplace_expire_stale` is executable only by `service_role`, validates its cutoff and batch size, and is scheduled once per minute.
- Pending credit offers reuse the idempotent offer-release path.
- Unconfirmed credit handoffs write one immutable `expiration_release` event and atomically restore available/reserved balances.
- Unconfirmed swaps reopen both listings atomically.
- A handoff with either confirmation moves to `disputed`; it does not release credits or listings.
- Worker-owned `expired_at` timestamps are protected by triggers.
- Kill switches do not disable expiry or safe recovery.

## Verification

- `supabase/migrations/__tests__/marketplaceExpiryWorkerMigration.test.ts`: migration surface, lock hierarchy, idempotency, grants, and schedule.
- `supabase/tests/database/marketplace_expiry_worker.test.sql`: 25 deadline, state, balance, retry, authorization, and validation assertions.
- `scripts/test-marketplace-party-upgrade.js`: two concurrent worker sessions expire the same credit offer/transaction without deadlock or duplicate release, followed by the complete legacy-upgrade, ledger, RLS, C07, and deletion suites.

The slice is complete only after the full quality gate, independent review, GitHub CI, and merge are green.
