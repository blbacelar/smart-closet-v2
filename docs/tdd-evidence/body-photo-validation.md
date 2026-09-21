# Body-photo validation TDD evidence

## Source and user journeys

This slice implements GitHub issue #11 from the original Fitly PRD and architecture.

- As a member, every newly uploaded body photo is checked before it can be used for a try-on.
- As a member, an accepted photo contains one clearly adult person, a usable full-body pose, and sufficient image quality.
- As a member whose photo is rejected, I receive only a stable, safe reason code rather than raw AI output.
- As an operator, every completed moderation call records one cost entry and concurrent retries cannot double-complete a photo.
- As an existing member, a pre-moderation photo remains usable after rollout without a fabricated provider charge.

The adapter follows Google's current [image-understanding](https://ai.google.dev/gemini-api/docs/image-understanding) and [structured-output](https://ai.google.dev/gemini-api/docs/structured-output) contracts. Requests use inline private image bytes, a strict JSON schema, and `store: false`.

## RED checkpoints

- Primary RED commit: `1f53f89 test: define body photo validation contracts`.
- Primary RED command: `npm test -- --runInBand src/features/body-photos/__tests__/bodyPhotoRepository.test.ts supabase/functions/validate-body-photo/__tests__/geminiModerationProvider.test.ts supabase/functions/validate-body-photo/__tests__/processor.test.ts supabase/functions/validate-body-photo/__tests__/handler.test.ts supabase/migrations/__tests__/bodyPhotoValidationMigration.test.ts`.
- Result: five suites failed for the intended missing upload trigger, provider, processor, handler, and migration.
- Rollout RED commit: `42bd828 test: define legacy photo rollout contract`.
- Result: the legacy-data test failed because the one-time migration did not yet exist.

## GREEN checkpoints

- Primary GREEN commit: `14ef746 feat: validate private body photos with Gemini`.
- Focused result: 5 suites and 42 tests passed after the database lifecycle test was added.
- Database lifecycle commit: `4600f08 test: verify body photo validation database lifecycle`.
- Rollout GREEN commit: `54c3a97 fix: preserve legacy body photo eligibility`.
- Local database result: 37 pgTAP assertions passed on the migrated schema.

## Test specification

| # | What is guaranteed | Test target | Type | Result |
| --- | --- | --- | --- | --- |
| 1 | A successful private upload invokes `validate-body-photo`; a temporary invocation failure leaves the saved photo pending | `bodyPhotoRepository.test.ts` | unit/integration | PASS |
| 2 | Gemini receives inline JPEG bytes through a stateless request with a strict JSON response schema | `geminiModerationProvider.test.ts` | provider contract | PASS |
| 3 | Only approved or allowlisted rejection decisions are accepted; raw or malformed provider output is rejected | `geminiModerationProvider.test.ts` | security | PASS |
| 4 | Rate limits and server failures retry with bounded backoff, while invalid configuration fails before spend | `geminiModerationProvider.test.ts` | unit | PASS |
| 5 | Owner photos are claimed once; completion carries the current attempt and safe reason into the atomic database boundary | `processor.test.ts` | unit | PASS |
| 6 | The endpoint requires JWT authentication, an exact UUID-only payload, and derives ownership from the session | `handler.test.ts` | API/security | PASS |
| 7 | Moderation state and cost commit together; stale/concurrent attempts cannot double-complete | `bodyPhotoValidationMigration.test.ts`, `rls.test.sql` | database | PASS |
| 8 | Pending or rejected photos cannot be inserted into a try-on job | `bodyPhotoValidationMigration.test.ts`, `rls.test.sql` | database/security | PASS |
| 9 | Existing pending photos are grandfathered once without an invented AI ledger entry | `legacyBodyPhotoValidationMigration.test.ts` | migration contract | PASS |

## Full verification and deployment

- `npm run test:coverage -- --ci`: 45 suites and 267 tests passed; 92.77% statements, 82.23% branches, 87.54% functions, and 94.13% lines.
- `npm run test:db`: 37 pgTAP assertions passed.
- `npm run typecheck`: passed.
- `npm run check:pii`: passed.
- `npx expo-doctor`: 18/18 checks passed.
- `npm run build:web`: Expo web export completed.
- `npm audit --omit=dev --audit-level=critical`: no critical production advisories.
- `supabase db lint --local` and `supabase db lint --linked`: no schema errors.
- Migrations `20260921213000` and `20260921213100` are applied locally and remotely.
- `validate-body-photo` version 1 is active with JWT verification enabled.
- Production unauthenticated smoke test: HTTP 401 with `UNAUTHORIZED_NO_AUTH_HEADER`.

## Known gaps

- No real member image was submitted during deployment verification. Doing so would process sensitive user content and incur provider spend; the request/response contract, database lifecycle, deployment, and authentication boundary are verified independently.
- Apparent-adult classification is a conservative eligibility screen, not identity or legal-age verification. Uncertain images are rejected with `age_not_confirmed` and should receive clearer retry guidance in issue #12.
- Issue #12 still needs the user-facing validation-state, rejection guidance, and manual retry experience.
- The configured Google project previously reported insufficient prepaid credits for image generation. Moderation requires a funded/available Gemini API project for a real-image check to complete.
