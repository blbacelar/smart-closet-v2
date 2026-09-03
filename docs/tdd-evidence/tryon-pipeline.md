# TDD Evidence: Persisted Try-On Pipeline

> Historical implementation record: the original FASHN adapter documented here was replaced by OpenRouter and then by direct Gemini on 2026-09-02. See `docs/tdd-evidence/gemini-tryon.md` for the current provider contract and deployment state.

- Source plan: Fitly PRD and technical architecture
- Feature: Authenticated asynchronous try-on with atomic quota, deterministic caching, private results, and one-time refunds
- Completed: 2026-09-02
- Framework: Jest 29, jest-expo 54, React Native Testing Library 14

## User Journeys

1. As a member, I can select my private body photo and a ready garment and start a real persisted fitting job.
2. As a member, repeating the same fitting reuses an active or completed job without consuming quota twice.
3. As a Free member, no more than three new fitting combinations can reserve provider spend per day.
4. As a member, a failed or timed-out fitting returns its quota exactly once.
5. As the product owner, provider credentials, input paths, cache construction, cost accounting, and result writes remain server-controlled.

## RED

Command:

`npm test -- --runTestsByPath supabase/functions/tryon-enqueue/__tests__/handler.test.ts supabase/functions/tryon-enqueue/__tests__/processor.test.ts supabase/functions/tryon-enqueue/__tests__/fashnProvider.test.ts src/features/tryon/__tests__/tryonRepository.test.ts src/features/tryon/__tests__/useTryOns.test.tsx`

Result: five suites failed because the handler, processor, provider adapter, client repository, and hooks did not exist. Preserved in commit `5e7bbd9`.

## GREEN

The completed implementation is preserved in commit `4da516a`.

| Guarantee | Evidence | Result |
| --- | --- | --- |
| Invalid or unauthenticated requests cannot reserve quota | Handler contract tests and deployed 401 smoke test | PASS |
| Missing provider configuration fails before job creation or quota use | Handler tests and linked secret inventory | PASS |
| Provider inputs and outputs use base64 rather than persistent public URLs | FASHN adapter contract tests | PASS |
| Transient creation errors retry; permanent errors do not | FASHN adapter tests | PASS |
| Worker stores only completed output and safely handles timeout/failure | Processor tests | PASS |
| Server computes cache keys and serializes duplicate reservations | Deployed migration and database lint | PASS |
| Quota reservation, completion/cost writes, and one-time refunds are transactional | Deployed database RPCs | PASS |
| Client reads owner-scoped jobs, signs private results, and polls active jobs | Repository and hook tests | PASS |
| Studio never substitutes the body photo as a generated result | Studio integration and removal of simulated timer | PASS |

## Verification

- 23 suites passing
- 140 tests passing
- 93.34% statements
- 81.41% branches
- 87.33% functions
- 94.59% lines
- TypeScript check: PASS
- Expo web export: PASS
- Expo Doctor: 18/18
- Linked database lint: PASS
- `tryon-enqueue`: ACTIVE with JWT verification

## Known Gaps

`FASHN_API_KEY` and `FASHN_TRYON_COST_USD` are intentionally absent from source control and the linked Supabase project. No paid provider request was made. The endpoint returns `provider_unavailable` before quota reservation until both secrets are configured.

The initial worker uses a Supabase Edge Function background task and bounded provider polling. A scheduled reconciler is still needed to recover a job if an Edge Function instance is interrupted. Realtime delivery and persisted thumbs feedback are also deferred to the next milestone.

The existing Expo/Metro dependency chain continues to report 25 transitive advisories (16 moderate and 9 high). Its automated remediation requires a breaking Expo SDK upgrade, so it remains deferred while the development build intentionally stays on SDK 54 for App Store Expo Go compatibility.
