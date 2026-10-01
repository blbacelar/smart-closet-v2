# ADR 0001: Marketplace membership and exchange credits

- Status: **Proposed — implementation blocked**
- Owner: Product founder
- Required approvers: Product, Canadian legal counsel, Canadian tax/accounting adviser, security/privacy owner
- Last reviewed: 2026-10-01
- Supersedes: nothing until accepted
- Related: GitHub #27, #36–#48; `plans/marketplace-loops-economy.md`; `plans/marketplace-economics-scenarios.md`

This is a decision record, not legal or tax advice. Items marked **Required** must have written evidence before this ADR can become Accepted and before marketplace implementation begins.

## Decision summary

Fitly proposes a closed-loop clothing marketplace with three mutually exclusive settlement modes:

1. Exchange with non-cash `market_credit` units.
2. Direct one-garment-for-one-garment swap.
3. Free peer give-away, with no charitable-receipt claim.

The safe product label remains **Fitly Credits** until trademark and bilingual review is complete. Internal schemas and APIs use `market_credit`, never a branded name. Credits are intended to be non-withdrawable, non-transferable outside completed garment transactions, non-purchasable as standalone packs, and incapable of producing a negative available balance. Those are product constraints, not legal classifications.

## Proposed decisions

These defaults may be accepted or replaced only through an updated ADR.

| Topic | Proposed decision | Approval |
| --- | --- | --- |
| Digital Pro | Keep the existing AI try-on `pro` entitlement separate from marketplace access. | Product + storefront review required |
| Marketplace access | Use a distinct annual `marketplace_member` entitlement. Browsing and waitlist remain free; initiating or accepting transactions requires an active entitlement. | Product + counsel + storefront review required |
| Settlement modes | Launch credits, direct swaps, and free give-aways. Do not launch cash sales, mixed credit/cash, multi-item swaps, auctions, shipping, credit gifting, or cash-out. | Product required |
| Credits | Whole units only; server-authored double-entry journal; no client-writable balances; no standalone credit sales. | Product + accounting + counsel required |
| Expiry | Paid-credit cohorts do not expire unless counsel provides a written permitted alternative. Membership lapse and transaction eligibility are separate from balance expiry. | Counsel required |
| Cash/Stripe | Do not implement Stripe Connect, seller payouts, CAD pricing, or commission unless this ADR is explicitly revised to retain cash. | Product required |
| Account deletion | Delete private closet/media and public profile content, but preserve only the restricted transaction, tax, fraud, and audit records required by an approved retention schedule. | Counsel + privacy required |
| Launch scope | Invite-only pilot in the Lower Mainland and Fraser Valley, B.C.; no broader launch until density and safety gates pass. | Product required |

## Storefront and payment decision matrix

No purchase CTA may ship while any **Required** cell is unresolved.

| Product | iOS | Android | Web | Required evidence |
| --- | --- | --- | --- | --- |
| Digital Fitly Pro | StoreKit subscription | Google Play subscription | Optional web subscription | Approved products, restore/refund/grace behavior, review notes |
| Marketplace membership + annual credits | **Hold** | **Hold** | **Hold** | Written counsel opinion plus written App Review/Play policy position for the combined access-and-physical-goods value |
| Standalone credit packs | Prohibited for MVP | Prohibited for MVP | Prohibited for MVP | ADR amendment required |
| Cash garment purchase | Prohibited by this proposal | Prohibited by this proposal | Prohibited by this proposal | ADR amendment and a physical-goods payment/tax design required |

Apple currently requires non-IAP payment methods for physical goods consumed outside the app, while digital features generally fall under in-app purchase rules. Google Play similarly excludes physical goods from Play billing but treats in-app virtual currency and digital subscriptions as Play-billed products. Because Fitly membership combines access with units redeemable for physical garments, engineering will not infer the correct rail from either general rule.

## Required product/economics approval

- [ ] Select annual price, grant allotment, and maximum annual issuance from a signed scenario memo. The exploratory scenarios in `plans/marketplace-economics-scenarios.md` are not prices.
- [ ] Define new-member, renewal, grace, cancellation, refund, revocation, chargeback, family-sharing, account-merge, and wind-down behavior.
- [ ] Define pending-to-available timing, new-account holds, per-listing credit bounds, velocity limits, concentration alerts, and platform-loss treatment.
- [ ] Define what a lapsed member may browse, list, offer, accept, confirm, dispute, earn, and spend.
- [ ] Define active-closet and minimum listing-density formulas by geography, category, and size, including owners, windows, sample sizes, and circuit breakers.
- [ ] Approve the final customer-facing name after trademark, common-law, domain, App Store, bilingual, pronunciation, and confusion checks.

## Required legal/tax/accounting approval

- [ ] Written Canadian and B.C. opinion on stored-value/prepaid-card treatment, auto-renewal, consumer protection, refunds, dormant balances, unclaimed property, and wind-down obligations.
- [ ] Written GST/PST treatment for membership, swaps, give-aways, credit transfers, and marketplace services, including whether Fitly collects a payment or other consideration on behalf of sellers.
- [ ] Written digital-platform reporting scope, fair-market-value method for non-cash exchanges, seller due-diligence thresholds, required tax identity, receipts, amendments, remittance, and record retention.
- [ ] Approved item terms for title/risk of loss, inspection, condition mismatch, counterfeits, recalls, hygiene exclusions, meetup safety/liability, no-shows, returns, evidence, disputes, and appeals.
- [ ] Approved privacy/data-retention schedule separating deletable account content from restricted tax, transaction, fraud, moderation, and audit records.

B.C. law generally prohibits expiry dates for prepaid purchase cards subject to statutory definitions and exceptions, and B.C. marketplace-facilitator guidance turns on the actual contract, sale, service, and payment flow. Those sources require counsel to classify Fitly’s final model; they do not establish that the proposed credits qualify or do not qualify.

## Required security and operations approval

- [ ] Threat model linked accounts, synthetic identities, account/credit resale, collusion, duplicate-image relisting, reservation griefing, stolen sessions, device/payment reuse, and moderator abuse.
- [ ] Require strong reauthentication for acceptance, handoff confirmation, sensitive identity changes, and balance-changing operator actions.
- [ ] Define dual approval for manual ledger adjustments and dispute outcomes that change balances.
- [ ] Approve append-only journal, immutable reversal, idempotency, reconciliation, audit export, and ledger-imbalance alert contracts.
- [ ] Approve dispute evidence limits, access roles, SLA, default outcome, appeal path, and deletion/retention behavior.
- [ ] Fund and staff an operator queue and complete a reconciliation/recovery drill before pilot launch.

## Engineering consequences after acceptance

1. Revise the PRD and architecture so this ADR is canonical.
2. Rewrite issues #27 and #36–#47 to remove incompatible CAD/Stripe assumptions and add accepted entitlement, mode, retention, and reporting contracts.
3. Build a generic membership and double-entry ledger foundation before transaction-specific reservations.
4. Validate all three interaction modes with representative participant pairs before persisting the offer/transaction state machine.
5. Implement server-authoritative listing, offer, settlement, dispute, notification, and reporting contracts with feature-specific kill switches.
6. Run iOS and Android staging journeys for credit, swap, give-away, cancellation, insufficient balance, lapse, and dispute before regional pilot activation.

Until this ADR is Accepted, the Market tab remains a non-transactional preview and no membership, credit, listing, offer, chat, push, payment, handoff, or rating schema is deployed.

## Rejected alternatives

- **Bundle Pro and marketplace membership now:** rejected pending storefront and legal review because it mixes digital functionality with physical-goods exchange value.
- **Treat credits as a simple integer balance:** rejected because it cannot support reliable reconciliation, refunds, reversals, concurrent reservations, or audit.
- **Keep cash and add credits simultaneously:** rejected for MVP complexity; requires a later ADR amendment.
- **Call free give-aways donations:** rejected because the product does not promise charitable status or tax receipts.
- **Implement first and resolve compliance later:** rejected because schema, billing, deletion, and settlement contracts depend on the unresolved decisions.

## Evidence to attach before acceptance

- Signed product/economics memo.
- Legal and tax/accounting memoranda for the launch jurisdiction.
- iOS, Android, and web SKU/payment matrix with review correspondence.
- Seller reporting and restricted identity-retention design.
- Marketplace terms, dispute policy, and privacy/retention schedule.
- Security threat model and operator runbooks.
- Updated PRD, architecture, and linked GitHub issue acceptance criteria.

## Primary sources to re-check at approval

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), especially user-generated content and payment rules.
- [Google Play Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738).
- [B.C. Business Practices and Consumer Protection Act, Part 4.1](https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/04002_05).
- [B.C. PST 142 — Online Marketplace Facilitators and Sellers](https://www2.gov.bc.ca/assets/gov/taxes/sales-taxes/publications/pst-142-marketplace-facilitators.pdf).
- [CRA reporting rules for digital platform operators](https://www.canada.ca/en/revenue-agency/programs/about-canada-revenue-agency/cra/compliance/reporting-rules-digital-platforms/guidance-on-reporting-rules.html).
