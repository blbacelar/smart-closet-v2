# Body-photo deletion TDD evidence

## Source and user journeys

This slice implements GitHub issue #31 and the Phase 1 privacy requirement for per-photo deletion.

- As a signed-in member, I can remove one private body photo without deleting my account.
- As a member who taps delete accidentally, I have five seconds to undo before server deletion starts.
- As a member whose deletion fails, I see a safe retry message and the photo is restored in the gallery.
- As a privacy-conscious member, I can see that body photos are private.
- As a photo owner, deleting a photo also removes its generated try-on result objects and cascades its job records.

The next numbered backlog item, issue #27 (RevenueCat and Pro entitlement), remains blocked by the marketplace membership/Product–Legal ADR in `plans/marketplace-loops-economy.md`. Issue #31 was therefore the next unblocked P1 slice.

## RED checkpoint

- Commit: `b000e39 test: define undoable body photo deletion`
- Command: `npm test -- --runInBand src/features/body-photos/__tests__/BodyPhotoGallery.test.tsx src/features/body-photos/__tests__/bodyPhotoRepository.test.ts src/features/body-photos/__tests__/useBodyPhotos.test.tsx supabase/functions/delete-body-photo/__tests__/deleteBodyPhoto.test.ts supabase/functions/delete-body-photo/__tests__/handler.test.ts`
- Result: the five suites failed for the intended missing gallery, repository method, mutation hook, deletion orchestrator, and authenticated handler.

## GREEN checkpoint

- Commit: `31790de feat: add undoable body photo deletion`
- Focused command: the same five-suite command above.
- Result: 5 suites passed, 23 tests passed.
- Typecheck: `npm run typecheck` passed.

## Test specification

| # | What is guaranteed | Test target | Type | Result |
| --- | --- | --- | --- | --- |
| 1 | The gallery explains private visibility and exposes an accessible per-photo delete action | `BodyPhotoGallery.test.tsx` | component | PASS |
| 2 | Delete hides the photo immediately, offers Undo, and does not call the server when undone | `BodyPhotoGallery.test.tsx` | component | PASS |
| 3 | The deletion commits after five seconds; a failure restores the photo with a generic retry message | `BodyPhotoGallery.test.tsx` | component | PASS |
| 4 | The repository invokes only `delete-body-photo`, validates its success response, and replaces endpoint detail with a safe client error | `bodyPhotoRepository.test.ts` | unit | PASS |
| 5 | A successful deletion invalidates the authenticated owner's body-photo list | `useBodyPhotos.test.tsx` | hook integration | PASS |
| 6 | The endpoint accepts only POST, requires a valid bearer session, validates an exact UUID payload, and derives ownership from authentication | `handler.test.ts` | unit/security | PASS |
| 7 | Only owner-prefixed paths can be removed; result objects precede the source photo and database record; storage failure preserves metadata | `deleteBodyPhoto.test.ts` | unit/security | PASS |

## Full verification

- `npm run test:coverage -- --ci`: 40 suites and 230 tests passed; 93.18% statements, 81.94% branches, 88% functions, and 94.34% lines.
- `npm run typecheck`: passed.
- `npm run check:pii`: passed.
- `npx expo-doctor`: 18/18 checks passed.
- `npm run build:web`: Expo web export completed.
- `npm audit --omit=dev --audit-level=critical`: no critical production advisories.
- `supabase functions deploy delete-body-photo`: version 1 deployed.
- `supabase functions list`: `delete-body-photo` is active with JWT verification enabled.
- Production unauthenticated smoke test: HTTP 401 with `UNAUTHORIZED_NO_AUTH_HEADER`.

## Known gaps

- The destructive path was not invoked against a real member photo because that would permanently remove user content. Ownership, cleanup order, error behavior, deployment, and gateway authentication are covered independently.
- Undo is intentionally available only before server deletion starts. Once the five-second window ends, the operation is permanent.
- The remaining transitive npm advisories require breaking Expo dependency changes. The project stays on SDK 54 during Expo Go development and must move to the required supported SDK before production release.
