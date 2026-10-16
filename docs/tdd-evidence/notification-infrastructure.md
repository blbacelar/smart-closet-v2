# C10 notification infrastructure — TDD evidence

GitHub authority: #43.

## Contract

- Permission is requested only from the explicit profile action and only on a physical SDK 57 development build.
- Token registration is private, idempotent, rotation-safe, and reassigns a duplicated device token to the latest authenticated account.
- Token ownership history is immutable; startup refresh and runtime native-token rotation update the active registration without another permission prompt.
- Logout and account-deletion start disable delivery before the identity can change.
- An immutable event key creates at most one outbox item and one delivery per active token.
- Workers use recoverable leases, bounded retry/backoff, poison-item isolation, and separate ticket/receipt state.
- Provider dispatch is fenced after preparation, records `sending` before POST, and never retries an ambiguous or abandoned provider attempt.
- Provider payloads contain generic copy plus allow-listed route data; tokens and payloads are never client-readable.
- Missing provider credentials defer work without consuming retry attempts. Physical delivery remains External Gate D.

## RED

Checkpoint command:

```sh
npm test -- --runInBand \
  src/features/notifications/__tests__/notificationRegistration.test.ts \
  supabase/functions/process-notification-outbox/__tests__/expoPushProvider.test.ts \
  supabase/functions/process-notification-outbox/__tests__/processor.test.ts \
  supabase/migrations/__tests__/notificationInfrastructureMigration.test.ts
```

The initial checkpoint failed four suites because `notificationRegistration`,
`expoPushProvider`, `processor`, and the notification migration did not yet
exist. A second RED checkpoint (`fc21a88`) added the post-review race cases and
failed 9 focused tests: token rotation/startup synchronization, prepare→send
authorization, ambiguous POST handling, permanent provider classification, and
the corresponding database lifecycle contract.

## GREEN

Implemented with Expo SDK 57-compatible `expo-notifications` 57.0.23 and
`expo-device` 57.0.2, a private migration, service-only Edge worker, explicit
profile action, and logout/account-deletion cleanup.

Focused Jest verification passed the notification and profile contracts. The
final `npm run quality` passed 94 suites and 551 tests with 90.82% statements,
80.41% branches, 85.21% functions, and 92.60% lines. PII scanning, Expo Doctor
21/21, web export, and the critical production audit passed. The isolated
database migration/lint, legacy backfill, all existing RLS/ledger/marketplace
suites, 48 notification pgTAP assertions, final Auth deletion with notification
history, and the two-connection outbox claim race passed. The review hardening
also added immutable historical token rows, pre-POST reauthorization, durable
`sending` state, no-retry ambiguous attempts, and complete permanent Expo error
classification. External Gate D still owns physical push delivery acceptance.
