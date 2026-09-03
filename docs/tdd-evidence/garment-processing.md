# TDD Evidence: Garment Background Processing

- Source plan: Journeys derived during this TDD run from the Fitly PRD and technical architecture.
- Feature: Authenticated, retryable garment cleanup with private Storage and atomic cost tracking
- Completed: 2026-09-02T22:40:56Z
- Framework: Jest 29, jest-expo 54, React Native Testing Library 14

## User Journeys

1. As a member, my uploaded garment is sent to a privileged cleanup worker without exposing provider credentials in the app.
2. As a member, transient provider failures retry automatically and permanent failures show a safe retry state.
3. As a member, retrying cleanup reuses my private original instead of uploading a duplicate garment.
4. As the product owner, concurrent calls cannot process the same garment twice and each garment receives at most three claimed attempts.
5. As the product owner, a successful result and its provider cost ledger entry finalize atomically.

## RED

Core command:

`npm test -- --runTestsByPath supabase/functions/process-garment/__tests__/processor.test.ts supabase/functions/process-garment/__tests__/removeBgProvider.test.ts supabase/functions/process-garment/__tests__/handler.test.ts src/features/garments/__tests__/garmentRepository.test.ts src/features/garments/__tests__/useGarments.test.tsx`

Result: five suites failed because the worker modules and client processing method did not exist. Preserved in commit `79df74e`.

Status/retry command:

`npm test -- --runTestsByPath src/features/garments/__tests__/garmentRepository.test.ts src/features/garments/__tests__/useGarments.test.tsx`

Result: two suites failed because persisted processing state was not mapped and retry invalidation was not yet guaranteed. Preserved in commit `5213b1e`.

Original-image fallback regression command:

`npm test -- --runTestsByPath supabase/functions/process-garment/__tests__/processor.test.ts supabase/functions/process-garment/__tests__/removeBgProvider.test.ts`

Result: four assertions failed because unconfigured remove.bg still threw, provider results had no content type, uploads were forced to PNG, and JPEG fallback paths were unsupported.

## GREEN

The provider-neutral processing core passed 30 focused tests before database/UI integration and is preserved in commit `d54a3cf`. The completed worker, client status handling, migration, deployment, and retry UI passed 31 focused tests and are preserved in commit `1617abf`.

The original-image fallback passed all 12 focused tests, then the complete project passed 140 tests. The linked `process-garment` worker was deployed as active version 3 with JWT verification enabled.

## Test Specification

| # | What is guaranteed | Test target | Type | Result |
| --- | --- | --- | --- | --- |
| 1 | Unauthorized and malformed requests never start processing | `handler.test.ts` | API contract | PASS |
| 2 | Handler responses map ready, busy, exhausted, missing, and failed states safely | `handler.test.ts` | API contract | PASS |
| 3 | Successful jobs download, clean, hash, upload, and atomically complete | `processor.test.ts` | Orchestration | PASS |
| 4 | Idempotent and busy/exhausted database states do not spend provider calls | `processor.test.ts` | Orchestration | PASS |
| 5 | Completion failures remove the newly uploaded clean object | `processor.test.ts` | Error integration | PASS |
| 6 | remove.bg requests use multipart server-side auth and bounded exponential retries | `removeBgProvider.test.ts` | Provider contract | PASS |
| 7 | Permanent provider errors do not retry and provider details are not exposed | Provider and handler tests | Security | PASS |
| 8 | Upload triggers processing without making provider failure look like upload failure | Garment repository and hook tests | Client integration | PASS |
| 9 | Manual retry refreshes the owner wardrobe after success or failure | `useGarments.test.tsx` | Hook integration | PASS |
| 10 | Claim, completion, failure, attempt limit, path ownership, and RPC grants are deployed | Migration list and database lint | Database | PASS |
| 11 | The authenticated function is deployed with JWT verification enabled | `npx supabase functions list` | Deployment | PASS |

## Coverage and Known Gaps

Final command: `npm run test:coverage`

- 140 tests passing
- 93.07% statements
- 80.88% branches
- 86.92% functions
- 94.05% lines

`REMOVE_BG_API_KEY` and `REMOVE_BG_COST_USD` remain optional and absent from source control. When they are not configured, the worker uses the original private JPEG, records an `original-image` provider entry at zero cost, and marks the garment ready for OpenRouter. When both are configured, the existing bounded remove.bg adapter produces a PNG. No paid remove.bg request is required for local or linked-project development.

`npm audit --omit=dev --audit-level=high` currently reports 25 transitive advisories (16 moderate and 9 high) in the existing Expo/Metro dependency chain. The automated remediation requires a breaking Expo SDK upgrade, so it was not forced while this development build intentionally remains on SDK 54 for App Store Expo Go compatibility.

## Merge Evidence

- Core RED checkpoint: `79df74e test: define garment cleanup pipeline`
- Core GREEN checkpoint: `d54a3cf feat: add garment cleanup processing core`
- Status RED checkpoint: `5213b1e test: define garment cleanup status and retry`
- Integrated GREEN checkpoint: `1617abf feat: deploy retryable garment cleanup worker`
