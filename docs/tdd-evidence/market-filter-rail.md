# Market filter rail TDD evidence

## User journey

As a member browsing the Market, I can swipe filters horizontally without exposing a draggable vertical indicator or bouncing the rail off-axis.

## RED checkpoint

- Commit: `d739304 test: reproduce market filter rail interaction bug`.
- Command: `npm test -- --runTestsByPath 'app/(tabs)/__tests__/market.test.tsx'`.
- Result: the test failed because the horizontal `ScrollView` did not disable its vertical indicator or bounce behavior. The rail was also only 34 px high.
- Physical-device follow-up showed a small remaining cross-axis movement after the first fix.
- Commit: `046450e test: reproduce market filter cross-axis movement`.
- Result: the expanded test failed because iOS automatic content-inset adjustment remained enabled and the content height was not pinned to the viewport height.

## GREEN checkpoint

- Commit: `e27d2fd fix: lock market filters to horizontal scrolling`.
- Both native indicators are disabled, vertical bounce is disabled, directional locking is enabled, and Android overscroll is suppressed.
- Commit: `579a7dc fix: pin market filter cross-axis height`.
- The rail and its content container are both fixed at 48 px, with the existing 34 px filter pills vertically centered. iOS automatic content and indicator inset adjustment is disabled. Horizontal filter navigation remains available.

## Test specification

| # | What is guaranteed | Test target | Type | Result |
| --- | --- | --- | --- | --- |
| 1 | The Market filter rail reserves 48 px of vertical space and pins its content to the same height | `market.test.tsx` | component/layout | PASS |
| 2 | Filter pills are vertically centered within the rail | `market.test.tsx` | component/layout | PASS |
| 3 | Native horizontal and vertical scroll indicators stay hidden | `market.test.tsx` | component | PASS |
| 4 | The rail does not bounce or accept off-axis movement | `market.test.tsx` | component/interaction | PASS |
| 5 | iOS does not inject automatic content or indicator insets | `market.test.tsx` | component/interaction | PASS |

## Verification

- Focused test: 1 test passed.
- Full suite: 50 suites and 297 tests passed.
- Coverage: 92.85% statements, 81.15% branches, 87.87% functions, and 94.15% lines.
- TypeScript: passed.
- Expo Doctor: 21/21 checks passed.
- Expo web export: passed.

## Known gap

The automated test verifies the native layout and interaction contract. Final appearance should still be confirmed in Expo Go on the physical device where the original behavior was visible.
