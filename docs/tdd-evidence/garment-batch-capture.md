# TDD Evidence: Batch Garment Capture

- Source story: GitHub issue #15, missing batch-capture portion
- Feature: Single-camera and ordered five-photo library capture with resilient per-piece upload
- Completed: 2026-09-30
- Frameworks: Jest 29 and React Native Testing Library 14

## User Journeys

1. As a member, I can take one garment photo or select up to five ordered photos from my library.
2. As a member, I can review each selected piece and give it independent name, category, color, and size metadata.
3. As a member, an unsuitable photo is identified and skipped without discarding the valid photos in the same selection.
4. As a member, if a later upload fails, previously saved pieces leave the queue and retrying uploads only the remaining pieces.
5. As a member, every accepted piece still enters the existing private upload and background-processing pipeline independently.

## RED

Command:

`npm test -- --runTestsByPath src/features/garments/__tests__/garmentPicker.test.ts src/features/garments/__tests__/GarmentCaptureScreen.test.tsx`

Result: ten assertions failed because the picker returned only its first asset, the library had no multi-selection configuration, and the screen had no batch editor, per-piece metadata state, or partial-failure queue. Preserved in commit `846ba3a`.

## GREEN

Command:

`npm test -- --runTestsByPath src/features/garments/__tests__/garmentPicker.test.ts src/features/garments/__tests__/GarmentCaptureScreen.test.tsx`

Result: all 14 focused assertions passed. The minimal implementation is preserved in commit `46e0f36`.

## Test Specification

| # | What is guaranteed | Test target | Type | Result |
| --- | --- | --- | --- | --- |
| 1 | Camera capture remains single-photo and permission-gated | `garmentPicker.test.ts` | Adapter unit | PASS |
| 2 | Library capture enables ordered multi-selection with a limit of five | `garmentPicker.test.ts` | SDK contract | PASS |
| 3 | Each selected photo retains independent metadata | `GarmentCaptureScreen.test.tsx` | Component integration | PASS |
| 4 | Every valid draft uploads in selection order and closes only after all succeed | `GarmentCaptureScreen.test.tsx` | Workflow integration | PASS |
| 5 | A partial failure retains only the failed and not-yet-attempted drafts | `GarmentCaptureScreen.test.tsx` | Failure integration | PASS |
| 6 | A mixed selection keeps valid photos and identifies the first rejected photo | `GarmentCaptureScreen.test.tsx` | Validation integration | PASS |
| 7 | Single-photo validation, keyboard behavior, manual category choice, and error recovery remain intact | Existing capture-screen assertions | Regression | PASS |

## Final Verification

- `npm run typecheck` — PASS
- `npm run test:coverage` — 313 tests PASS; 92.59% statements, 81.48% branches, 87.14% functions, 94.17% lines
- `npm run check:pii` — PASS
- `npx expo-doctor` — 21/21 checks PASS after applying the current SDK 57 patch set in commit `bbc3ab1`
- `npm run build:web` — PASS
- `npm audit --omit=dev --audit-level=critical` — no critical production advisory

## Known Gaps

- The native system picker interaction still needs a short physical-device smoke test because Jest verifies the Expo adapter contract rather than rendering iOS or Android system UI.
- Live background processing remains dependent on the pending linked Supabase deployment recorded in issue #14; batch capture itself requires no new database schema.

## Merge Evidence

- RED checkpoint: `846ba3a test: define batch garment capture flow`
- GREEN checkpoint: `46e0f36 feat: add resilient batch garment capture`
- SDK compatibility checkpoint: `bbc3ab1 chore: align Expo SDK 57 patch versions`
