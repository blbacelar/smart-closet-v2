# TDD Evidence: Private Body-Photo Persistence

- Source plan: Journeys derived during this TDD run from the Fitly PRD and architecture.
- Feature: Authenticated capture, validation, private upload, persistence, and display
- Completed: 2026-09-02T21:42:01Z
- Framework: Jest 29, jest-expo 54, React Native Testing Library 14

## User Journeys

1. As an authenticated member, I can take or choose a full-body photo so I can use my own image in Fitly.
2. As a member, I receive actionable feedback before upload when a photo is unreadable, too large, too small, or landscape.
3. As a privacy-conscious member, my image is stored under my user-owned private path and displayed through a temporary signed URL.
4. As a member, a failed metadata write does not leave an orphaned private image.
5. As a plan owner, Free and Pro photo limits are enforced by the database even if the client is bypassed.

## RED

Command:

`npm test -- --runTestsByPath src/features/body-photos/__tests__/bodyPhotoValidation.test.ts src/features/body-photos/__tests__/bodyPhotoPicker.test.ts src/features/body-photos/__tests__/bodyPhotoRepository.test.ts src/features/body-photos/__tests__/BodyPhotoCaptureScreen.test.tsx`

Result: four suites failed because the requested body-photo modules did not exist. This was the intended compile-time RED state and is preserved in commit `5aa31af`.

## GREEN

Implemented the picker adapter, validation boundary, Supabase repository, TanStack Query hooks, capture screen, protected modal route, live Profile/Studio rendering, and database limits. The targeted body-photo suite passed 19/19 before the query-hook tests were added. The complete implementation is preserved in commit `dff955f`.

## Test Specification

| # | What is guaranteed | Test target | Type | Result |
| --- | --- | --- | --- | --- |
| 1 | Valid portrait images are accepted and sized from encoded bytes | `bodyPhotoValidation.test.ts` | Unit | PASS |
| 2 | Missing, oversized, undersized, and landscape images are rejected | `bodyPhotoValidation.test.ts` | Unit | PASS |
| 3 | Camera permission, library selection, and cancellation are handled | `bodyPhotoPicker.test.ts` | Unit | PASS |
| 4 | Records are owner-filtered and receive one-hour signed URLs | `bodyPhotoRepository.test.ts` | Integration boundary | PASS |
| 5 | Storage succeeds before metadata insertion and uses a new user path | `bodyPhotoRepository.test.ts` | Integration boundary | PASS |
| 6 | Failed metadata insertion removes the uploaded object | `bodyPhotoRepository.test.ts` | Error integration | PASS |
| 7 | Capture UI handles success, cancellation, denial, validation, retry, and change-photo flows | `BodyPhotoCaptureScreen.test.tsx` | Component | PASS |
| 8 | Queries remain disabled when signed out and invalidate after upload | `useBodyPhotos.test.tsx` | Hook integration | PASS |
| 9 | Server limits and permissions were deployed to the linked Supabase project | `npx supabase migration list` | Database | PASS |

## Coverage and Known Gaps

Final command: `npm run test:coverage`

- 47 tests passing before final configuration hardening
- 97.71% statements
- 83.53% branches
- 96.66% functions
- 97.66% lines

Automated visual content moderation and true pose-quality analysis remain intentionally deferred. Current validation covers file readability, encoded upload size, minimum resolution, and portrait orientation.

## Merge Evidence

- RED checkpoint: `5aa31af test: define private body photo flow`
- GREEN checkpoint: `dff955f feat: persist private body photos`
