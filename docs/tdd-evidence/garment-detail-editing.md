# Garment detail editing TDD evidence

## Source and user journeys

This slice implements GitHub issue #17 from the Fitly product backlog and the Phase 1 PRD requirement that members can tag garments by category, color, size, and season.

- As a member, I can open any item in my private closet and review its image, processing state, category, and tags.
- As a member, I can edit the garment name, category, color, size, and season from a keyboard-safe half-sheet.
- As a member, invalid details remain local and explain how to correct them.
- As a member, a failed save keeps the editor open and never exposes database/provider details.

The implementation was checked against the required [Expo SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/) while retaining SDK 54 for current Expo Go development compatibility.

## RED checkpoint

- Commit: `5476e8f test: define garment detail editing experience`.
- Command: `npm test -- --runInBand src/features/garments/__tests__/GarmentDetailScreen.test.tsx src/features/garments/__tests__/garmentRepository.test.ts src/features/garments/__tests__/useGarments.test.tsx`.
- Result: three suites failed for the intended missing detail component, repository update operation, and update mutation hook.

## GREEN checkpoint

- Commit: `a0b6319 feat: add garment detail editing`.
- Focused result: 3 suites and 20 tests passed.
- Full result: 47 suites and 292 tests passed.

## Test specification

| # | What is guaranteed | Test target | Type | Result |
| --- | --- | --- | --- | --- |
| 1 | The detail screen presents the selected private garment and all existing metadata | `GarmentDetailScreen.test.tsx` | component | PASS |
| 2 | The editing half-sheet remains operable while the keyboard is open | `GarmentDetailScreen.test.tsx` | component/accessibility | PASS |
| 3 | Name, category, color, size, and season are trimmed and validated before persistence | `GarmentDetailScreen.test.tsx` | component/unit | PASS |
| 4 | Invalid input never reaches the repository | `GarmentDetailScreen.test.tsx` | component | PASS |
| 5 | Save failures keep the editor open and hide database internals | `GarmentDetailScreen.test.tsx` | component/security | PASS |
| 6 | The repository updates only the allowlisted editable fields for the selected garment | `garmentRepository.test.ts` | integration | PASS |
| 7 | A successful update invalidates the authenticated owner's closet query | `useGarments.test.tsx` | integration | PASS |
| 8 | Existing pgTAP policy coverage permits owner metadata edits and blocks cross-owner edits | `supabase/tests/database/rls.test.sql` | database/security | PASS in remote CI |

## Coverage and verification

- `npm run test:coverage -- --ci`: 47 suites and 292 tests passed; 92.85% statements, 81.15% branches, 87.87% functions, and 94.15% lines.
- `npm run typecheck`: passed.
- `npm run check:pii`: passed.
- `npx expo-doctor`: 18/18 checks passed.
- `npm run build:web`: Expo web export completed.
- `npm audit --omit=dev --audit-level=critical`: passed with no critical advisories; known high/moderate Expo transitive advisories require the intentionally deferred SDK upgrade.

## Known gaps

- Native visual behavior was not exercised on a physical device during the automated run; component behavior and the web export are verified.
- This issue does not add garment deletion. Item deletion needs storage-aware cleanup and should be implemented as a separate lifecycle slice rather than a metadata update.
