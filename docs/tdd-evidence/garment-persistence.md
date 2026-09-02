# TDD Evidence: Private Garment Persistence

- Source plan: Journeys derived during this TDD run from the Fitly PRD and architecture.
- Feature: Authenticated garment capture, validation, private upload, persistence, and live Closet/Studio display
- Completed: 2026-09-02T22:24:41Z
- Framework: Jest 29, jest-expo 54, React Native Testing Library 14

## User Journeys

1. As an authenticated member, I can photograph or choose a garment and add its details to my private closet.
2. As a member, I receive actionable feedback before upload when an image is unreadable, too large, too small, or missing required metadata.
3. As a privacy-conscious member, my garment is stored under my user-owned private path and displayed through a temporary signed URL.
4. As a member, a failed metadata write does not leave an orphaned private image.
5. As a Free member, the database stops my 51st garment even if clients upload concurrently; Pro garment inserts are unlimited.
6. As a member, I see cleanup as pending until a real privileged background-removal worker completes it.

## RED

Command:

`npm test -- --runTestsByPath src/features/garments/__tests__/garmentValidation.test.ts src/features/garments/__tests__/garmentPicker.test.ts src/features/garments/__tests__/garmentRepository.test.ts src/features/garments/__tests__/useGarments.test.tsx src/features/garments/__tests__/GarmentCaptureScreen.test.tsx`

Result: five suites failed because the requested garment modules did not exist. This was the intended compile-time RED state and is preserved in commit `4e3acb3`.

## GREEN

Implemented the picker adapter, asset and metadata validation, Supabase repository, TanStack Query hooks, capture screen, protected modal route, and live Closet/Studio rendering. The focused suite passed 24/24 and the implementation checkpoint is preserved in commit `b466b3a`.

## Test Specification

| # | What is guaranteed | Test target | Type | Result |
| --- | --- | --- | --- | --- |
| 1 | Readable images are accepted and sized from encoded bytes | `garmentValidation.test.ts` | Unit | PASS |
| 2 | Missing, oversized, and undersized images are rejected | `garmentValidation.test.ts` | Unit | PASS |
| 3 | Required metadata is normalized and unsupported categories are rejected | `garmentValidation.test.ts` | Unit | PASS |
| 4 | Camera permission, library selection, and cancellation are handled | `garmentPicker.test.ts` | Unit | PASS |
| 5 | Owner-filtered records use one-hour signed URLs and prefer a cleaned image | `garmentRepository.test.ts` | Integration boundary | PASS |
| 6 | The original is uploaded before processing metadata and is removed after an insert failure | `garmentRepository.test.ts` | Error integration | PASS |
| 7 | Capture UI handles success, permission denial, validation, missing metadata, and upload errors | `GarmentCaptureScreen.test.tsx` | Component | PASS |
| 8 | Queries remain disabled when signed out and invalidate after upload | `useGarments.test.tsx` | Hook integration | PASS |
| 9 | Limits, path ownership, RLS, and column grants are deployed to the linked project | Supabase migration and lint | Database | PASS |

## Coverage and Known Gaps

Final command: `npm run test:coverage`

- 71 tests passing
- 95.4% statements
- 83.19% branches
- 93.54% functions
- 95.3% lines

Background removal and automatic garment tagging remain intentionally deferred. Uploaded originals remain usable in Closet and Studio with a visible cleanup-pending state; the app does not pretend processing has completed.

## Merge Evidence

- RED checkpoint: `4e3acb3 test: define garment persistence flow`
- GREEN checkpoint: `b466b3a feat: persist private garments`
