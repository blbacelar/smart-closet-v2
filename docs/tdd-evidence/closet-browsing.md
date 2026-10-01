# TDD Evidence: Closet Browsing

- Source story: GitHub issue #16, T-016
- Feature: Persisted closet grid, garment cards, category filters, empty state, and recovery
- Completed: 2026-09-30
- Frameworks: Jest 29 and React Native Testing Library 14

## User Journeys

1. As a member, I can browse my persisted garments as cards and open a garment for details.
2. As a member, I can filter the closet by category and assistive technology announces the selected filter.
3. As a new member, I can start garment capture directly from an empty closet.
4. As a member whose closet failed to load, I can retry without leaving the screen.

## RED

Command:

`npm test -- --runTestsByPath 'app/(tabs)/__tests__/closet.test.tsx'`

Result: four acceptance tests passed, while the category-filter test failed because the visual filter chips did not expose a button role or selected state. Preserved in commit `a9efb25`.

## GREEN

Focused command:

`npm test -- --runTestsByPath 'app/(tabs)/__tests__/closet.test.tsx'`

Result: all five screen tests passed after exposing the header action and category filters as buttons and announcing each filter's selected state. Preserved in commit `4716731`.

## Test Specification

| # | What is guaranteed | Test target | Test type | Result |
| --- | --- | --- | --- | --- |
| 1 | The horizontal filter rail hides indicators and rejects off-axis bounce | `closet.test.tsx` | component/layout | PASS |
| 2 | Persisted garment cards render names and open the correct detail route | `closet.test.tsx` | component/navigation | PASS |
| 3 | Category selection removes nonmatching cards and exposes selected state | `closet.test.tsx` | component/accessibility | PASS |
| 4 | An empty closet offers a direct route to garment capture | `closet.test.tsx` | component/navigation | PASS |
| 5 | A failed closet query offers an in-place retry | `closet.test.tsx` | component/error recovery | PASS |

## Full Verification

- `npm run typecheck` — PASS
- `npm run test:coverage` — 52 suites and 318 tests PASS; 92.62% statements, 81.60% branches, 87.18% functions, and 94.19% lines
- `npm run check:pii` — PASS
- `npx expo-doctor` — 21/21 checks PASS
- `npm run build:web` — PASS

## Known Gap

Automated tests verify the React Native interaction and accessibility contract. Native scrolling feel and final card appearance remain physical-device visual checks rather than screenshot assertions.

## Merge Evidence

- RED checkpoint: `a9efb25 test: define closet browsing acceptance`
- GREEN checkpoint: `4716731 fix: expose accessible closet filters`
