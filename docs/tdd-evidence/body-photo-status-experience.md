# Body-photo status experience TDD evidence

## Source and user journeys

This slice implements GitHub issue #12 from the Fitly product backlog.

- As a member, I can tell whether each private body photo is checking, ready, or needs replacement.
- As a member whose photo is rejected, I receive useful fixed guidance without raw AI or provider output.
- As a member whose check temporarily fails, I can retry while attempts remain and receive replacement guidance after the third attempt.
- As a privacy-conscious member, I can open a concise explanation of visibility, Gemini processing, and deletion.
- As a member starting a fitting, I can select only an approved body photo.

## RED checkpoint

- Commit: `2f4e133 test: define body photo status and retry experience`.
- Command: `npm test -- --runInBand src/features/body-photos/__tests__/bodyPhotoPresentation.test.ts src/features/body-photos/__tests__/bodyPhotoRepository.test.ts src/features/body-photos/__tests__/useBodyPhotos.test.tsx src/features/body-photos/__tests__/BodyPhotoGallery.test.tsx`.
- Result: four suites failed for the intended missing presentation module, retry repository/hook boundary, safe status and guidance UI, and privacy sheet.

## GREEN checkpoint

- Commit: `59eb983 feat: add body photo validation status experience`.
- Focused result: 4 suites and 35 tests passed.
- Full result: 46 suites and 285 tests passed.

## Test specification

| # | What is guaranteed | Test target | Type | Result |
| --- | --- | --- | --- | --- |
| 1 | Approved, pending, and rejected photos use clear fixed labels | `bodyPhotoPresentation.test.ts`, `BodyPhotoGallery.test.tsx` | unit/component | PASS |
| 2 | Every allowlisted rejection code maps to fixed guidance and unknown values receive a safe fallback | `bodyPhotoPresentation.test.ts` | security/unit | PASS |
| 3 | Raw validation/provider errors never appear in the body-photo UI | `BodyPhotoGallery.test.tsx` | component/security | PASS |
| 4 | A paused check can retry below three attempts, while an exhausted photo cannot retry | `BodyPhotoGallery.test.tsx` | component | PASS |
| 5 | Manual retry uses the authenticated Edge Function boundary and invalidates the owner's query | `bodyPhotoRepository.test.ts`, `useBodyPhotos.test.tsx` | integration | PASS |
| 6 | Active pending photos poll until a terminal or paused state | `useBodyPhotos.test.tsx` | unit | PASS |
| 7 | The privacy sheet discloses app visibility, stateless Gemini processing, and deletion | `BodyPhotoGallery.test.tsx` | component | PASS |
| 8 | Only approved body photos are eligible for Studio try-ons | `bodyPhotoPresentation.test.ts` | unit/security | PASS |

## Coverage and verification

- `npm run test:coverage -- --ci`: 46 suites and 285 tests passed; 92.62% statements, 82.71% branches, 87.63% functions, and 93.98% lines.
- `npm run typecheck`: passed.
- `npm run check:pii`: passed.
- `npx expo-doctor`: 18/18 checks passed.
- `npm run build:web`: Expo web export completed.
- `npm audit --omit=dev --audit-level=critical`: passed with no critical advisories; known high/moderate Expo transitive advisories require the intentionally deferred SDK upgrade.

## Known gaps

- Native visual behavior was not exercised on a physical device in this automated run; component behavior and the web export are verified.
- Historical note: this slice was first verified on SDK 54. The app upgraded to SDK 57 on 2026-09-21 for current Expo Go compatibility.
- `npm run test:db` could not connect because the local Supabase/Docker service was stopped. This client-only slice does not change the database; the existing database suite last passed with 37 assertions during issue #11.
