# C12 marketplace nearby discovery — TDD evidence

GitHub authority: #36. Follow-on moderation/filter work: #37.

## Contract

- Only server-quantized coordinates are stored, in private tables.
- Nearby discovery is authenticated, radius-bounded, stale-location aware, and
  returns rounded distance without coordinates.
- Active listing geography follows relocation and is removed on clear,
  withdrawal, profile deletion, or account-deletion start.
- Keyset pagination cannot repeat the preceding row.
- Location writes participate in the account-deletion advisory-lock fence.

## RED

Commit `5c35dbd` introduced the migration, repository, and pgTAP contracts before
implementation. Focused Jest failed because the migration file and repository
methods did not exist. The first database run then exposed a pgTAP-version
helper mismatch; after replacing the unsupported helper, the executable tests
identified an out-of-radius fixture and the existing Auth deletion guard. Those
fixtures were corrected without weakening production behavior. A final
pre-commit review added the missing immediate-deletion purge and a two-connection
write-versus-tombstone race.

## GREEN

The final `npm run quality` passed 95 suites and 564 tests with 90.93%
statements, 80.88% branches, 84.96% functions, and 92.62% lines. PII scanning,
Expo Doctor 21/21, web export, and the critical production audit passed.

The isolated database harness passed forward migration over legacy data,
application-schema lint with errors enforced, RLS 77/77, all ledger and
marketplace suites, C10 notification tests 48/48, C12 discovery tests 28/28,
and all existing concurrency/deletion suites. Its two-connection discovery
race proved that a late location write waits for account deletion and is then
rejected without recreating geography.
