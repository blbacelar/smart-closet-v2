# Account deletion TDD evidence

## Source and user journeys

This slice implements GitHub issue #30 and the Phase 1 privacy requirement in the PRD and architecture documents.

- As a signed-in member, I can permanently delete my Fitly account and all current Phase 1 private images.
- As a cautious member, I must type `DELETE` before the destructive action becomes available.
- As a member whose deletion encounters a service failure, I see a safe retry message and remain signed in.
- As a deleted member, an unexpired access token cannot create or access private Storage objects after the profile cascade completes.

## RED checkpoint

- Commit: `12ac874 test: add account deletion security contracts`
- Command: `npm test -- --runTestsByPath src/features/auth/__tests__/authGateway.test.ts src/providers/__tests__/AuthProvider.test.tsx src/features/account/__tests__/AccountDeletionScreen.test.tsx supabase/functions/delete-account/__tests__/handler.test.ts supabase/functions/delete-account/__tests__/deleteAccount.test.ts supabase/migrations/__tests__/accountDeletionMigration.test.ts`
- Result: 6 suites failed for the intended missing implementation: absent screen, handler, deletion orchestrator, migration, auth gateway method, and provider method. Sixteen pre-existing assertions still passed.

## GREEN checkpoint

- Commit: `63d374d feat: add secure account deletion flow`
- Focused command: the same six-suite command above.
- Result: 6 suites passed, 42 tests passed.
- Typecheck: `npm run typecheck` passed.

## Test specification

| # | What is guaranteed | Test target | Type | Result |
| --- | --- | --- | --- | --- |
| 1 | The client invokes only `delete-account` with the fixed destructive confirmation and clears its local session after success | `authGateway.test.ts` | unit | PASS |
| 2 | Provider failures are replaced with a safe message and do not sign the member out | `authGateway.test.ts` | unit | PASS |
| 3 | App identity clears only after server deletion succeeds | `AuthProvider.test.tsx` | integration | PASS |
| 4 | The UI explains the purge, requires exact `DELETE`, blocks duplicate requests, supports cancellation, and safely reports failure | `AccountDeletionScreen.test.tsx` | component | PASS |
| 5 | The endpoint accepts only POST, requires a valid caller, rejects extra identity input, and derives the target user from authentication | `handler.test.ts` | unit/security | PASS |
| 6 | All `body`, `garments`, and `results` objects are removed before the Auth user, and an unsafe cross-user path aborts deletion | `deleteAccount.test.ts` | unit/security | PASS |
| 7 | Every private Storage operation requires a still-existing profile, closing the deleted-user stale-JWT window | `accountDeletionMigration.test.ts` | migration contract | PASS |

## Full verification

- `npm run test:coverage`: 30 suites and 182 tests passed; 93.39% statements, 81.57% branches, 88.1% functions, and 94.13% lines.
- `npx expo-doctor`: 18/18 checks passed.
- `npm run build:web`: Expo web export completed.
- `npx supabase db lint --linked`: no schema errors.
- `npx supabase db push --linked`: migration `20260903120000_account_deletion_storage_guard.sql` applied.
- `npx supabase functions deploy delete-account`: version 1 deployed with JWT verification enabled.
- `npx supabase migration list --linked`: local and remote migration histories match through `20260903120000`.

## Known gaps

- The permanent action was not smoke-tested against a real user because that would destroy user data. The handler, cleanup order, client flow, policy replacement, remote migration, and deployed function bundle are covered independently.
- `npm audit --omit=dev --audit-level=high` reports transitive Expo SDK 54 issues whose suggested remediation is a breaking upgrade to SDK 57. The project remains on SDK 54 by prior product decision for App Store Expo Go compatibility; this must be resolved before production release.
- This Phase 1 purge intentionally has no marketplace tax or transaction records. Issue #48 requires a new retention/deletion ADR before marketplace launch.
