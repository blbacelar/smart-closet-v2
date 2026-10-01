# Marketplace economy scenarios

**Date:** 2026-09-30  
**Status:** exploratory input to issue #48; not approved pricing, accounting advice, or a launch authorization  
**Working product term:** Fitly Credits  
**Internal code term:** `market_credit`

## Why this model exists

The proposed marketplace grants credits with annual membership and transfers them between members when clothing changes hands. Transfers do not reduce the total credit supply. If credits neither expire nor incur a transaction burn, outstanding stock grows with every new membership and renewal. This model makes that accumulation visible before the product fixes a fee or allotment.

These figures are deliberately simple and reproducible. They are planning scenarios, not forecasts. They exclude taxes, refunds, chargebacks, store fees, fraud losses, dormant-member behavior, customer acquisition cost, and support cost until those inputs are approved.

## Common formulas

- `renewed members = prior-year active members × renewal rate`
- `active paid members = new paid members + renewed members`
- `annual revenue = active paid members × annual fee`
- `credits issued = active paid members × annual allotment`
- `outstanding stock = prior stock + issued - reversed - retired`
- `transfer volume = active paid members × transfers/member × average credit price`
- `velocity = annual transfer volume ÷ year-end outstanding stock`

All three scenarios use zero expiry and zero retirement. This is intentionally conservative: B.C. rules generally prohibit expiry and most fees for value that qualifies as a prepaid purchase card. Counsel must determine whether and how those rules apply to this design.

## Inputs

| Scenario | Annual fee | Annual allotment | New paid members Y1 / Y2 / Y3 | Renewal | Transfers per active member | Average garment price |
|---|---:|---:|---:|---:|---:|---:|
| Cautious | CAD 39 | 60 credits | 300 / 600 / 1,000 | 50% | 1.5 | 15 credits |
| Base | CAD 59 | 120 credits | 500 / 1,000 / 1,800 | 65% | 3.0 | 25 credits |
| Liquidity-heavy | CAD 79 | 240 credits | 750 / 1,500 / 2,500 | 75% | 5.0 | 35 credits |

## Three-year outputs

| Scenario | Year | Active paid members | Gross membership revenue | Credits issued that year | Outstanding stock | Transfer volume | Credits per active member | Velocity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Cautious | 1 | 300 | CAD 11,700 | 18,000 | 18,000 | 6,750 | 60.0 | 0.38 |
| Cautious | 2 | 750 | CAD 29,250 | 45,000 | 63,000 | 16,875 | 84.0 | 0.27 |
| Cautious | 3 | 1,375 | CAD 53,625 | 82,500 | 145,500 | 30,938 | 105.8 | 0.21 |
| Base | 1 | 500 | CAD 29,500 | 60,000 | 60,000 | 37,500 | 120.0 | 0.63 |
| Base | 2 | 1,325 | CAD 78,175 | 159,000 | 219,000 | 99,375 | 165.3 | 0.45 |
| Base | 3 | 2,661 | CAD 156,999 | 319,320 | 538,320 | 199,575 | 202.3 | 0.37 |
| Liquidity-heavy | 1 | 750 | CAD 59,250 | 180,000 | 180,000 | 131,250 | 240.0 | 0.73 |
| Liquidity-heavy | 2 | 2,063 | CAD 162,977 | 495,120 | 675,120 | 361,025 | 327.3 | 0.53 |
| Liquidity-heavy | 3 | 4,047 | CAD 319,713 | 971,280 | 1,646,400 | 708,225 | 406.8 | 0.43 |

## Interpretation

- Every scenario accumulates more credits per active member and loses velocity over time. Membership renewal grants cannot be chosen independently from a legitimate credit sink or a much lower recurring allotment.
- The liquidity-heavy scenario creates 1.65 million outstanding credits by year three. It should not proceed without evidence that inventory breadth and transaction demand can absorb them.
- The base scenario is suitable only as a user-research anchor. It is not a pricing recommendation.
- A transfer is not a burn: moving 25 credits from buyer to seller changes who holds the liability but not total stock.
- Account closure, refund, and fraud adjustments cannot be treated as an informal economic sink. Each requires an approved journal treatment and consumer-facing rule.

## Required next simulations

The next model revision needs observed pilot distributions rather than single averages:

1. New and renewing member cohorts by month.
2. Listing supply by geography, category, and size.
3. Garment-price distribution and repricing behavior.
4. Percentage of members who both earn and spend.
5. Dormant balance distribution and top-1% concentration.
6. Refunds before and after grants are spent, including platform-loss outcomes.
7. Store/payment fees, GST/PST, AI cost, moderation cost, support contacts, disputes, and fraud loss.
8. Explicit approved retirement mechanics, if any, with a separate legal conclusion.

## Proposed storefront matrix for review

This matrix separates the digital Fitly Pro entitlement from marketplace access. The marketplace row remains a hold because annual access plus credits redeemable for physical garments crosses policy categories and needs written review.

| Product | iOS | Android | Web | Current recommendation |
|---|---|---|---|---|
| Digital Fitly Pro | StoreKit subscription | Google Play subscription | Web subscription if offered | Keep a separate `pro` entitlement; never bundle marketplace credits |
| Marketplace membership | **Hold before sale**; request App Review guidance | **Hold before sale**; request Play policy guidance | Provider checkout may be prototyped only after counsel approves terms | Separate `marketplace_member` entitlement; no mobile purchase or external CTA until cleared |
| Fitly Credits | Never sold separately | Never sold separately | Never sold separately | Server-issued/earned closed-loop units only; no cash-out, gifting, packs, or cash mixing |
| Physical garment exchange | Non-IAP payment rail only if cash sales are later retained | Non-Play-billing rail only if cash sales are later retained | Approved physical-goods payment rail | Proposed first release has credits, direct swap, and free give-away—not cash sales |

Lifecycle requirements apply regardless of provider: idempotent purchase/restore, renewal, grace, cancellation, refund, revocation, chargeback, account merge, and provider-transaction ownership. The database remains authoritative for entitlements and grants.

## Policy evidence to give counsel and store review

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/): digital functionality generally uses in-app purchase, while physical goods consumed outside the app use other payment methods. Purchased in-app currency may not expire.
- [Google Play Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738): digital app functionality generally uses Play billing, while physical goods and peer-to-peer payments are excluded from it.
- [B.C. Business Practices and Consumer Protection Act, Part 4.1](https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/04002_05): prepaid purchase cards generally cannot expire and most related fees are prohibited, subject to definitions and regulatory exceptions.
- [Consumer Protection BC subscription contracts](https://www.consumerprotectionbc.ca/consumer-help/subscription-contracts/): qualifying automatically renewing subscriptions have disclosure, notice, and cancellation requirements.
- [CRA digital-platform reporting guidance](https://www.canada.ca/en/revenue-agency/programs/about-canada-revenue-agency-cra/compliance/reporting-rules-digital-platforms/guidance-on-reporting-rules.html): non-fiat and barter consideration may require a fair-market-value amount in Canadian dollars when it is reasonably knowable.
- [B.C. PST 142](https://www2.gov.bc.ca/assets/gov/taxes/sales-taxes/publications/pst-142-marketplace-facilitators.pdf): marketplace-facilitator and marketplace-service rules require tax review for the actual operating model.

These sources establish review questions, not legal conclusions.
