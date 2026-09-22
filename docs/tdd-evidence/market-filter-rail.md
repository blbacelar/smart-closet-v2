# Market filter rail TDD evidence

## User journey

As a member browsing the Market, I can see each filter chip's complete border and swipe filters horizontally without exposing a draggable vertical indicator or bouncing the rail off-axis.

## RED checkpoint

- Commit: `d739304 test: reproduce market filter rail interaction bug`.
- Command: `npm test -- --runTestsByPath 'app/(tabs)/__tests__/market.test.tsx'`.
- Result: the test failed because the horizontal `ScrollView` did not disable its vertical indicator or bounce behavior. The rail was also only 34 px high.
- Physical-device follow-up showed a small remaining cross-axis movement after the first fix.
- Commit: `046450e test: reproduce market filter cross-axis movement`.
- Result: the expanded test failed because iOS automatic content-inset adjustment remained enabled and the content height was not pinned to the viewport height.
- A physical-device screenshot then showed the chip's bottom border touching the 48 px viewport clipping boundary.
- Commit: `634074c test: reproduce clipped market filter border`.
- Result: the expanded test failed because the rail left only 14 px of total vertical clearance around the 34 px chip, below the required 20 px minimum.
- A physical-device recording showed the chip row repeatedly moving 31 device pixels upward while the heading and product grid stayed fixed. At the recorded 3x scale, this was approximately 10.3 layout points of cross-axis travel.
- Commit: `7bd4f4f test: reproduce market filter rail shrink`.
- Result: the test failed because the rail did not override React Native's shrinkable horizontal `ScrollView` base layout.

## GREEN checkpoint

- Commit: `e27d2fd fix: lock market filters to horizontal scrolling`.
- Both native indicators are disabled, vertical bounce is disabled, directional locking is enabled, and Android overscroll is suppressed.
- Commit: `579a7dc fix: pin market filter cross-axis height`.
- Commit: `723ccea fix: add clearance around market filter chips`.
- The rail and its content container are both fixed at 56 px, with the existing 34 px filter pills vertically centered and 11 px of clearance on each side. iOS automatic content and indicator inset adjustment remains disabled. Horizontal filter navigation remains available.
- Commit: `5fa461b fix: prevent market filter rail compression`.
- The rail now explicitly sets `flexShrink: 0`, preserving its full 56 px viewport instead of allowing the native horizontal `ScrollView` to compress below its 56 px content height and create vertical scroll range.

## Test specification

| # | What is guaranteed | Test target | Type | Result |
| --- | --- | --- | --- | --- |
| 1 | The Market filter rail reserves at least 56 px of vertical space and pins its content to the same height | `market.test.tsx` | component/layout | PASS |
| 2 | The rail cannot shrink below its fixed height and create cross-axis scroll range | `market.test.tsx` | component/layout | PASS |
| 3 | Filter pills are vertically centered within the rail | `market.test.tsx` | component/layout | PASS |
| 4 | A 34 px chip has at least 20 px of total vertical clearance, keeping its border away from the clipping boundary | `market.test.tsx` | component/layout | PASS |
| 5 | Native horizontal and vertical scroll indicators stay hidden | `market.test.tsx` | component | PASS |
| 6 | The rail does not bounce or accept off-axis movement | `market.test.tsx` | component/interaction | PASS |
| 7 | iOS does not inject automatic content or indicator insets | `market.test.tsx` | component/interaction | PASS |

## Verification

- Focused test: 1 test passed.
- Full suite: 50 suites and 297 tests passed.
- Coverage: 92.85% statements, 81.15% branches, 87.87% functions, and 94.15% lines.
- TypeScript: passed.
- Expo Doctor: 21/21 checks passed.
- Expo web export: passed.

## Known gap

The automated test verifies the native layout and interaction contract. Final appearance should still be confirmed in Expo Go on the physical device where the original behavior was visible.
