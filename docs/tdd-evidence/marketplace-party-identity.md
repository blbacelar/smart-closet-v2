# C03 marketplace party identity evidence

## Outcome

Marketplace accounting and transaction rows now have an opaque, private party
identity that is independent from the public profile/Auth UUID. A live profile
is still linked during the compatibility window, but that link is nullable and
uses `ON DELETE SET NULL`; the durable party foreign key remains non-null.

This slice deliberately does not define retention durations or make the current
account-deletion function marketplace-aware. C05 owns deletion orchestration,
private-content purge, legal holds, and write barriers. C03 establishes the
identity boundary those flows require.

## TDD sequence

1. Added migration-contract tests before the migration existed; all five tests
   failed because the expected migration was absent.
2. Added the forward-only migration and passed the five structural contracts.
3. Applied the full migration chain to an empty local Supabase database.
4. Added pgTAP fixtures for party synchronization, mismatched-party rejection,
   RLS ownership, profile detachment, and retained ledger reconciliation.
5. Diagnosed and corrected a test-fixture collision where a swap transaction
   legitimately retained image access after a listing withdrawal.
6. Automated a prior-version upgrade harness that creates a temporary Supabase
   project with its own project ID and ports, resets only that isolated database
   to migration `20261016030000`, loads legacy membership/account/listing/offer/
   transaction/ledger fixtures, applies C03, verifies 13 backfill invariants,
   and removes the temporary stack in `finally` and signal handlers.
7. Diagnosed and corrected an invalid legacy fixture path surfaced by the new
   harness; garment paths now obey the owner-prefix constraint.
8. Diagnosed and corrected global-count assertions so pgTAP remains isolated on
   both empty and already-seeded databases.

## Compatibility contract

- `private.marketplace_parties.id` is the durable opaque key.
- `private.marketplace_parties.user_id` is a nullable live-profile link and is
  never directly readable by authenticated or anonymous clients.
- Membership, credit account, listing, offer, transaction, and credit-ledger
  rows receive non-null party foreign keys.
- Legacy `user_id`, `seller_id`, and `buyer_id` columns remain available and
  nullable for current SDK/server RPC compatibility.
- Before-write triggers derive and verify party keys for legacy inserts, so old
  app versions and the two-account seed cannot create inconsistent identities.
- RLS participant checks use a boolean security-definer helper that reveals
  ownership only; it never returns the party mapping.

## Verification

| Guarantee | Evidence | Result |
| --- | --- | --- |
| Migration contract exists and is forward-only | targeted Jest migration suite: 5/5 | PASS |
| Empty database accepts the complete migration chain | `supabase db reset --local` | PASS |
| Existing marketplace data is backfilled | automated prior-version reset + legacy fixtures + C03 migration + pgTAP 13/13 | PASS |
| Upgrade test cannot reset the developer database | isolated temporary project/ports; a sentinel profile in the active stack survived the full harness | PASS |
| Legacy seed remains idempotent after migration | rerun kept 2 parties, 2 accounts, 2 ledger rows, 1 listing, 600 available credits | PASS |
| Party map is private and member rows remain isolated | pgTAP 77/77 | PASS |
| Profile detachment preserves membership/account/ledger party links | pgTAP detachment fixtures | PASS |
| Schema is valid | `supabase db lint --local` | PASS |
| Project quality remains green | 83 Jest suites / 480 tests, PII check, Expo Doctor 21/21, web export, critical audit gate, upgrade pgTAP 13/13, RLS pgTAP 77/77 | PASS |

## Rollback

Do not delete party rows or rewrite retained history. If a defect is found,
disable dependent marketplace mutations and ship a forward correction
migration while preserving read/reconciliation access.
