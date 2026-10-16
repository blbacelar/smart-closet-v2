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

Pending implementation and focused/full verification.
