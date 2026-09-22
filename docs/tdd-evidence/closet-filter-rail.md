# Closet filter rail TDD evidence

## User journey

As a member browsing my closet, I can use the category filters without seeing a cramped native scroll indicator around the filter pills.

## RED checkpoint

- Commit: `a669feb test: reproduce cramped closet filter rail`.
- Command: `npm test -- --runTestsByPath 'app/(tabs)/__tests__/closet.test.tsx'`.
- Result: the test failed because the horizontal rail was only 32 px high, exactly matching the filter pills instead of providing the required 44 px cross-axis space.

## GREEN checkpoint

- Commit: `373ff06 fix: increase closet filter rail height`.
- The rail is 44 px high, its content has a 44 px minimum height, and the existing 32 px pills are vertically centered.
- The native horizontal scroll indicator remains disabled.

## Test specification

| # | What is guaranteed | Test target | Type | Result |
| --- | --- | --- | --- | --- |
| 1 | The Closet filter rail reserves at least 44 px of vertical space | `closet.test.tsx` | component/layout | PASS |
| 2 | Filter pills are vertically centered within the taller rail | `closet.test.tsx` | component/layout | PASS |
| 3 | The native horizontal scroll indicator stays hidden | `closet.test.tsx` | component | PASS |

## Verification

- Focused test: 1 test passed.
- Full suite: 49 suites and 296 tests passed.
- Coverage: 92.85% statements, 81.15% branches, 87.87% functions, and 94.15% lines.
- TypeScript: passed.
- Expo Doctor: 21/21 checks passed.
- Expo web export: passed.

## Known gap

The automated test verifies the native layout contract. Final appearance should still be confirmed in Expo Go on the physical device that showed the original scrollbar.
