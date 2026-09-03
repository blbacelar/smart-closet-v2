# TDD Evidence: Persisted Try-On Feedback

- Source: Phase 1 roadmap, next unblocked product slice
- Completed: 2026-09-03
- Framework: Jest 29, jest-expo 54, and React Native Testing Library 14

## User Journey

As a Fitly member viewing a completed private try-on, I can choose thumbs up or thumbs down, see that choice immediately, and have it remain attached to my completed job. If saving fails, the previous choice returns and the result screen explains what happened.

## RED

Command:

`npm test -- --runTestsByPath src/features/tryon/__tests__/tryonRepository.test.ts src/features/tryon/__tests__/useTryOns.test.tsx src/features/tryon/__tests__/TryOnFeedback.test.tsx`

Result: 3 suites failed. The feedback component and mutation hook did not exist, and the repository exposed no feedback method.

Checkpoint: `b95efb4 test: add try-on feedback behavior`

## GREEN Guarantees

| Guarantee | Evidence |
| --- | --- |
| Only `-1` or `1` can cross the repository boundary | Zod input contract and repository tests |
| Updates target one completed try-on job | Supabase update filters and repository test |
| Ownership remains server-enforced | Existing owner-scoped RLS policy and column-level feedback grant |
| The selected rating updates without waiting for the network | React Query optimistic-cache test |
| A failed save restores the previous rating | Mutation rollback test |
| Completed ratings are refreshed from persisted server state | Query invalidation test |
| Controls expose selected and disabled states | Component accessibility tests |
| The result screen explains save failures | Studio result integration |

Implementation checkpoint: `3f06caf feat: persist try-on feedback`

## Verification

- Focused feedback tests: 3 suites and 15 tests passing.
- Full test suite: 24 suites and 147 tests passing.
- Coverage: 93.06% statements, 80.42% branches, 87.50% functions, and 93.77% lines.
- TypeScript check: PASS.
- No database migration was required; the deployed schema already permits authenticated owners to update only `feedback` on their own completed jobs.
