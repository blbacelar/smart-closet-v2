# Market filter rail TDD evidence

## User journey

As a member browsing the Market, I can swipe filters horizontally without exposing a draggable vertical indicator or bouncing the rail off-axis.

## RED checkpoint

- Commit: `d739304 test: reproduce market filter rail interaction bug`.
- Command: `npm test -- --runTestsByPath 'app/(tabs)/__tests__/market.test.tsx'`.
- Result: the test failed because the horizontal `ScrollView` did not disable its vertical indicator or bounce behavior. The rail was also only 34 px high.

## GREEN checkpoint

- Commit: `e27d2fd fix: lock market filters to horizontal scrolling`.
- Both native indicators are disabled, vertical bounce is disabled, directional locking is enabled, and Android overscroll is suppressed.
- The rail is 44 px high, with the existing 34 px filter pills vertically centered. Horizontal filter navigation remains available.

## Test specification

| # | What is guaranteed | Test target | Type | Result |
| --- | --- | --- | --- | --- |
| 1 | The Market filter rail reserves at least 44 px of vertical space | `market.test.tsx` | component/layout | PASS |
| 2 | Filter pills are vertically centered within the rail | `market.test.tsx` | component/layout | PASS |
| 3 | Native horizontal and vertical scroll indicators stay hidden | `market.test.tsx` | component | PASS |
| 4 | The rail does not bounce or accept off-axis movement | `market.test.tsx` | component/interaction | PASS |

## Verification

- Focused test: 1 test passed.
- Full suite: 50 suites and 297 tests passed.
- Coverage: 92.85% statements, 81.15% branches, 87.87% functions, and 94.15% lines.
- TypeScript: passed.
- Expo Doctor: 21/21 checks passed.
- Expo web export: passed.

## Known gap

The automated test verifies the native layout and interaction contract. Final appearance should still be confirmed in Expo Go on the physical device where the original behavior was visible.
