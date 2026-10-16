# ADR-0002: Marketplace-aware account deletion boundary

**Date**: 2026-10-15
**Status**: proposed
**Deciders**: Product founder; legal/privacy approval remains Gate B

## Context

Fitly's original deletion flow removed Storage objects and then deleted the Auth
user. Marketplace journals and completed exchanges now use a durable opaque
party identifier and must not be corrupted by profile deletion. The final legal
retention periods, legal-hold rules, and destruction schedule are not approved,
so engineering needs a boundary that removes personal content immediately while
keeping only restricted, pseudonymous records under a versioned pending policy.

## Decision

Account deletion begins with a durable tombstone that blocks new personal-data
and marketplace writes. The service resumes Storage and database purge from
checkpoints, removes private media/closet/try-on data and authored messages,
anonymizes retained listing shells, and deletes Auth last. Opaque accounting and
exchange records remain restricted and detached from the live profile until the
Gate B retention policy and C06 destruction lifecycle are approved.

## Alternatives Considered

### Delete every marketplace row

- **Pros**: Minimal retained data.
- **Cons**: Breaks immutable accounting, counterparty transaction history, and reconciliation.
- **Why not**: Financial and exchange integrity cannot depend on whether one participant keeps an account.

### Block all marketplace participants from deletion

- **Pros**: Avoids retention design work.
- **Cons**: Denies a core privacy control even after exchanges are complete.
- **Why not**: Only unresolved activity should block deletion; completed history can be pseudonymized.

### Delete Auth first and clean up asynchronously

- **Pros**: Revokes sign-in immediately.
- **Cons**: Foreign-key failures and worker races can leave discoverable content or an unrecoverable partial purge.
- **Why not**: Auth deletion is the final atomic checkpoint, after reversible cleanup has succeeded.

## Consequences

### Positive

- Retries resume without repeating completed Storage or database work.
- In-flight clients and service workers cannot recreate personal content after the tombstone.
- Completed ledger and exchange records remain reconcilable through an opaque party.

### Negative

- Deletion orchestration has more states and requires service-role RPCs.
- Listing shells and accounting records exist beyond profile deletion in a restricted form.

### Risks

- **Unapproved retention period**: every request records
  `deletion-v1-gate-b-pending`; C06 may not ship until Gate B defines duration,
  holds, destruction, and backup re-deletion.
- **Unresolved exchange**: deletion returns a deterministic conflict before a
  tombstone is created; C07/C15 will own settlement and dispute resolution.
- **Stale workers**: table triggers and Storage policy checks reject writes from
  both member sessions and service workers unless the matching purge request is
  executing its internal bypass.
