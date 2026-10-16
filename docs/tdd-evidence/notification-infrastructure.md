# C10 notification infrastructure — TDD evidence

GitHub authority: #43.

## Contract

- Permission is requested only from the explicit profile action and only on a physical SDK 57 development build.
- Token registration is private, idempotent, rotation-safe, and reassigns a duplicated device token to the latest authenticated account.
- Logout and account-deletion start disable delivery before the identity can change.
- An immutable event key creates at most one outbox item and one delivery per active token.
- Workers use recoverable leases, bounded retry/backoff, poison-item isolation, and separate ticket/receipt state.
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

Expected result: four suites failed because `notificationRegistration`,
`expoPushProvider`, `processor`, and the notification migration did not yet
exist. This proves the new contract was not already satisfied by unrelated
code.

## GREEN

Implemented with Expo SDK 57-compatible `expo-notifications` 57.0.23 and
`expo-device` 57.0.2, a private migration, service-only Edge worker, explicit
profile action, and logout/account-deletion cleanup.

Focused Jest verification passed the notification and profile contracts. The
final `npm run quality` passed 94 suites and 541 tests with 90.84% statements,
80.40% branches, 85.08% functions, and 92.53% lines. PII scanning, Expo Doctor
21/21, web export, and the critical production audit passed. The isolated
database migration/lint, legacy backfill, all existing RLS/ledger/marketplace
suites, 33 notification pgTAP assertions, and the two-connection outbox claim
race passed. External Gate D still owns physical push delivery acceptance.
