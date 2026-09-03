# Fitly Marketplace Membership and Exchange-Credit Economy Blueprint

Status: **discovery ticket only; no-go for implementation until Step 1 is approved**  
Tracking issue: [#48](https://github.com/blbacelar/smart-closet-v2/issues/48)  
Safe working term: **Fitly Credits** in product drafts and `market_credit` in code  
Naming note: **Loops** has a strong circular-fashion metaphor but is commercially crowded and must not ship without clearance  
Product phase: plan before Phase 2; launch only after the regional marketplace activation gate

## Objective

Replace the current cash-first marketplace assumption with a HomeExchange-inspired membership economy. A member pays an annual fee, receives an annual allotment of Fitly Credits, earns credits when another member acquires their garment, and spends credits on garments listed by other members. Two peers may instead agree to a direct garment-for-garment swap with no credits, and a garment may be offered as a free peer-to-peer give-away for zero credits.

This is a proposed direction change for the existing Marketplace Foundation, Offers, and Payments epics. No implementation should begin until the business, legal, tax, accounting, App Store/Play, identity-retention, and migration decisions in Step 1 are approved; the PRD, architecture, and affected tickets are then revised and committed as the canonical contract.

## Product Model

### Membership

- People may create a closet, browse public listings, and join the regional waitlist before paying.
- An active annual marketplace membership is required to initiate or finalize a marketplace transaction.
- A successful first membership purchase and each renewal grant a server-defined allotment of credits exactly once, subject to an approved pending/available schedule and refund policy.
- The annual price, allotment, renewal behavior, and treatment of unused balances are configuration—not hard-coded client values.
- Keep digital Fitly Pro and marketplace membership as separate products by default. A combined SKU is prohibited until counsel and both storefront reviews clear its exact composition and payment rail.

### Fitly Credits

- “Fitly Credits” is a descriptive placeholder. “Loops,” “Threads,” “Buttons,” and the final name require trademark, common-law, App Store, bilingual, pronunciation, and confusion checks. Internal code always uses neutral `market_credit` vocabulary.
- Credits are proposed closed-loop units, not CAD, not cryptocurrency, not withdrawable for cash, and not transferable outside completed marketplace transactions. These statements are product intent, not legal conclusions.
- MVP excludes buying extra credits, cashing out credits, gifting credits directly, negative available balances, and mixed swap-plus-credit deals.
- Balances come from balanced, append-only, idempotent server journals. Clients never write balances or postings directly.
- Seller-set prices are positive whole credits within configurable bounds. The UI may suggest ranges by category and condition but does not force a price.

### Transaction Modes

1. **Credit exchange:** buyer offers the listed credit price or a negotiated amount. Acceptance reserves the buyer’s available credits; approved settlement releases them to the seller.
2. **Direct swap:** each party identifies one eligible listed garment. Acceptance atomically reserves both listings; approved settlement creates sanitized acquired-garment copies with no credit movement.
3. **Free give-away:** listing price is zero. The giver chooses a recipient from claims; approved settlement completes the transfer with no credit movement and no representation of a charitable receipt.

One listing may advertise one or more acceptable modes, but every accepted offer resolves to exactly one settlement mode. A reserved garment cannot participate in another active transaction.

## Core Invariants

- Every credit grant, reservation, release, refund, retirement, or administrative adjustment is a balanced double-entry journal with one immutable reason, reversal link where applicable, provider transaction ID, grant cohort, terms version, CAD valuation snapshot, jurisdiction, and idempotency key.
- Available balance can never become negative, including concurrent offers.
- A credit transfer, two-listing swap reservation, or free-give-away reservation is atomic.
- Only the two transaction participants can read offers, conversations, handoff details, and ledger entries relevant to that transaction.
- Body photos and private try-on results remain invisible to sellers and other marketplace users.
- Cancellation or timeout releases reservations exactly once.
- Completion requires the approved handoff proof and confirmation policy; disputes freeze settlement for review under a defined evidence standard, SLA, default outcome, appeal path, and audited moderator authority.
- Account deletion must preserve the restricted seller identity/tax and transaction records required by the approved retention policy while deleting personal content. The existing full-cascade deletion design must be replaced before marketplace launch.

## Dependency Graph

```text
Step 1 Canonical product/legal/tax/store ADR
  ├── Step 2 Membership + generic ledger foundation
  └── Step 3 Marketplace interaction design
          │
Step 2 ───┼──> Step 4 Listing modes + offers
          │             │
          └─────────────┴──> Step 5 Settlement + disputes
                                      │
                          Step 6 End-to-end app experience
                                      │
                          Step 7 Controlled regional rollout
```

Steps 2 and 3 may run in parallel after Step 1 only if Step 2 remains a generic membership/double-entry ledger foundation; transaction-specific reservation RPCs wait for the approved Step 3 state contract. Steps 4–7 are sequential because each depends on the preceding persisted state machine.

## Step 1 — Approve the Economy and Compliance ADR

### Context Brief

The current PRD and issues #40, #41, #44, #45, and #46 assume CAD sales, Stripe Connect payouts, a 10% commission, and separate monthly/yearly Pro subscriptions. The new model replaces or materially changes those assumptions. HomeExchange demonstrates reciprocal and point-based non-reciprocal exchanges, but clothing, stored-value, tax, consumer-protection, and mobile-store rules require independent review. Until this step produces a canonical committed decision, all affected marketplace tickets remain blocked.

### Tasks

- Decide the marketplace-membership relationship to digital Fitly Pro before issue #27 or public Pro sales. Default to separate entitlements unless a combined product is explicitly cleared.
- Produce a storefront-by-storefront SKU/payment matrix for iOS, Android, and web, separating digital functionality, marketplace access, and units redeemable for physical goods. Include purchase, restore, renewal, grace, refund, revocation, chargeback, and review-note behavior.
- Model at least three annual price/allotment scenarios across multiple years. Measure issuance, transfer volume, retirement, outstanding stock by cohort, concentration, dormant balances, implied item-price inflation, renewal value, inventory shocks, AI/support costs, and platform losses—not an “earn/burn” ratio.
- Default paid credits to non-expiring until written legal/store conclusions approve another treatment. Define lapse behavior separately for browsing, listing, offering, accepting, confirming, disputing, earning, and spending; acceptance snapshots settlement eligibility so expiry cannot strand a handoff.
- Obtain Canadian legal/accounting/tax review covering closed-loop stored value, B.C. prepaid-card and auto-renewal rules, GST/PST, barter/non-cash valuation, marketplace-facilitator status, consumer protection, unclaimed property, refunds, and record retention.
- Design seller due diligence and reporting: CAD fair-market valuation method, identity/address/TIN thresholds, quarterly totals, receipts, amended returns, remittance rail, six-year records where applicable, and a restricted tax-identity vault. Do not remove compliance onboarding merely because cash payout onboarding disappears.
- Define refund-after-spend and post-completion dispute treatment: grant provenance and states, pending/available/held balances, settlement holds, innocent-recipient rules, reversal journals, platform loss/debt accounts, and provider transaction uniqueness across restore, account merge, and family-sharing cases.
- Define linked-account/device/payment risk, new-account settlement holds, velocity/concentration limits, duplicate-image/relisting detection, strong settlement reauthentication, reservation-griefing limits, and explicit account/credit resale prohibitions.
- Define marketplace item terms: title/risk of loss, inspection, condition mismatch, counterfeits, recalls, hygiene exclusions, no-shows, meetup liability, returns, evidence, and the distinction between a free peer gift and a charitable donation.
- Run trademark, common-law, domain, App Store, bilingual, pronunciation, singular/plural, and confusion checks for Fitly Credits and all naming candidates; retain neutral internal names.
- Define measurable launch and circuit-breaker thresholds with formulas, owners, windows, and sample sizes. The 500-active-closet gate must define “active” and be paired with listing coverage by geography, category, and size.
- Write and commit an ADR that explicitly supersedes or retains cash, Stripe, commission, subscription, deletion, and data-retention assumptions. Revise the PRD, architecture, capability contract, and issues #27, #30, and #36–#47 before any implementation ticket becomes actionable.

### Verification and Exit Criteria

- Signed product/economics memo with annual fee, allotment, issuance limits, renewal, lapse, cancellation, refund/revocation, wind-down, and dispute rules.
- Approved legal/tax/accounting memo, seller-reporting design, and iOS/Android/web SKU/payment matrix.
- Accepted ADR and committed PRD/architecture revisions link every changed assumption in issues #27, #30, and #36–#47.
- No critical item from the epic’s adversarial review remains undecided.

### Rollback

Abandon this epic before code and retain the current cash-first marketplace backlog. If money has already been accepted, execute the approved wind-down terms instead of merely disabling the feature.

## Step 2 — Build Membership and Generic Ledger Foundation

### Context Brief

Implement only the approved neutral backend contracts. Subscription providers are event sources; the database remains authoritative for grants and balances. The ledger must be auditable, balanced, and safe under webhook retries, refunds, restores, and concurrent requests. Transaction-specific reservation behavior waits for the Step 3 contract.

### Tasks

- Add marketplace entitlements, versioned membership terms, double-entry accounts/journals/postings, immutable reversals, provider-event ownership, and idempotency constraints through forward-only migrations.
- Represent issuance, member available/pending/held, escrow, retirement, platform loss/debt, store fees, and taxes explicitly; do not persist a client-writable balance.
- Implement server-only operations for pending/available annual grants, releases, refund/revocation journals, and dual-approved administrative corrections. Defer marketplace settlement RPCs until Steps 4–5.
- Mirror the approved annual entitlement from the selected billing provider through a signed, replay-safe webhook.
- Expose owner-only balance and transaction history queries; never expose another member’s total balance.
- Add pgTAP concurrency, RLS, idempotency, and negative-balance tests.
- Add reconciliation from store transaction to membership term to grant to accounting export, including fees, taxes, refunds, retirement, and provider lifecycle events.

### Verification and Exit Criteria

- Duplicate/reordered webhook events cannot double-grant credits, and one provider transaction cannot belong to multiple accounts.
- Concurrent reservations cannot overdraw an account.
- Refund-after-partial/full-spend, refund reversal, grace recovery, downstream seller spend, and post-settlement dispute fixtures reconcile without corrupting innocent recipients or available balances.
- Balanced postings reconstruct every member and platform account and pass RLS tests.
- Metrics and alerts exist for ledger imbalance and failed reconciliation.

### Rollback

Disable grants and transaction RPCs with a feature flag; preserve ledger rows for audit and issue a forward migration for schema corrections.

## Step 3 — Validate Marketplace Interaction Design

### Context Brief

Design the three modes before committing to a transaction-specific database state machine. The interaction must make settlement mode, recipient obligations, pickup safety, and credit consequences unmistakable.

### Tasks

- Prototype annual membership, credit balance/history, listing-mode selection, seller pricing, credit offers, swap garment selection, free-give-away claims, confirmation, cancellation, lapse, and dispute flows.
- Test neutral language with users: “Exchange with credits,” “Swap clothes,” and “Give away.”
- Test whether sellers understand that credits are not cash, cannot be withdrawn, and may have reporting consequences under the approved terms.
- Define accessibility, localization, error, empty, insufficient-balance, expired-membership, and competing-offer states.
- Validate currency candidates separately from interaction comprehension.

### Verification and Exit Criteria

- Representative buyer/seller, swap, giver/recipient dyads plus an operator complete all three modes and dispute/lapse/error scenarios without facilitator correction.
- Users correctly explain credit earning/spending, settlement timing, and the absence of cash-out.
- Approved component/state specification covers every settlement and failure state.

### Rollback

Revise or rename the model before persisted contracts or public marketing exist.

## Step 4 — Add Listing Modes and Negotiated Offers

### Context Brief

Extend Marketplace Foundation only after Steps 1–3 are approved. Existing closet garments remain owner-private; listings expose only the approved public garment projection and approximate pickup area.

### Tasks

- Extend listings with accepted modes, an optional whole-credit asking price, reservation-aware status, and a partial unique constraint allowing only one active listing per garment.
- Extend offers as a discriminated credit/swap/free-give-away contract with exactly one applicable payload, immutable versioned counteroffers, withdrawal/expiry rules, and idempotency keys. A swap garment must have its own eligible listing.
- Enforce ownership, eligibility, active membership, status, and mode compatibility on the server.
- Permit pending offers but atomically revalidate and fund only one acceptance; prevent self-offers, linked-account abuse, offers on unavailable garments, and one garment appearing in multiple accepted transactions.
- Update discovery filters and listing detail to display credits, swap availability, and free give-aways.
- Keep marketplace try-on privacy unchanged.

### Verification and Exit Criteria

- RLS and API tests prove that only eligible users can create/read/respond to relevant offers.
- Invalid or ambiguous mixed-mode offers are rejected.
- Seller pricing and all three listing modes pass component and device E2E tests; “public” discovery is explicitly resolved as authenticated or anonymous in the ADR.

### Rollback

Disable offer creation and hide mode controls while retaining draft listings; correct contracts through forward migrations.

## Step 5 — Implement Atomic Settlement, Handoff, and Disputes

### Context Brief

Accepted offers become transactions. The database, not either client, owns reservation and settlement. Existing double-confirmation and safety backlog concepts remain useful, but Stripe capture is replaced by credit release or no-credit exchange completion unless the ADR retains cash as an additional mode.

### Tasks

- Define separate offer and transaction state machines. For every event, specify actor, authorization, preconditions, state change, balanced ledger effect, listing effect, notification, timeout, evidence, and idempotency scope—including which party confirmed and every dispute outcome.
- On acceptance, atomically revalidate membership, ownership, balance, risk holds, listing availability, and mode; snapshot immutable terms; create the transaction; reserve credits or both swap listings; and supersede competing offers.
- Release credits to the seller only after the approved handoff proof, confirmation, and dispute-window policy.
- Never reassign the seller’s private garment row or Storage path. Atomically archive the seller listing/garment and create a sanitized acquired-garment copy for the recipient; swaps create two sanitized copies.
- Add expiry jobs that release stale reservations exactly once.
- Add dispute freezes, case states, evidence rules, SLA/default outcomes, appeals, scoped moderator permissions, dual approval for balance-changing resolutions, audit events, notification idempotency, and account-deletion constraints.
- Add an operator console/runbook and complete an audited reconciliation and recovery drill before exit.
- Prohibit clients from directly changing balance, reservation, or terminal transaction fields.

### Verification and Exit Criteria

- Concurrency tests cover two buyers, two swap offers, repeated confirmations, cancellations, expiry, and moderator resolution.
- Every state transition is auditable and idempotent.
- No failure path strands credits or a listing reservation.

### Rollback

Use separate kill switches for acquisition, grants, offer creation, acceptance, and settlement. Keep webhook intake, reconciliation, confirmation, dispute/refund tools, history, and export live. Execute the approved notice, renewal-stop, refund/redemption valuation, support-funding, tax-amendment, and data-retention wind-down plan.

## Step 6 — Deliver the End-to-End App Experience

### Context Brief

Upgrade and validate the app from Expo SDK 54 to the project’s required SDK 57 before integrating marketplace-native dependencies. Then connect the approved backend state machine to the Expo app. The Market, Inbox, listing, offer, membership, balance, and handoff surfaces must use server state and Realtime updates while retaining safe retry behavior.

### Tasks

- Implement annual membership and credit balance/history surfaces; avoid “wallet” copy unless naming/legal research approves it.
- Implement create-listing, discovery, listing detail, try-on, offer/chat, swap selection, free-give-away claim, and handoff flows.
- Add push notifications and Realtime invalidation for offers and transaction status.
- Add clear safety guidance, approximate location, report/block, and accessible confirmations.
- Add analytics without garment-private metadata, exact location, message content, or body-photo data.
- Add Maestro journeys for each settlement mode plus cancellation and insufficient balance.

### Verification and Exit Criteria

- All three modes complete on iOS and Android against a staging Supabase project.
- Offline/retry behavior never duplicates an offer, grant, reservation, confirmation, or transfer.
- Accessibility, privacy, security, and store-review checklists pass.

### Rollback

Remote-disable marketplace transaction entry points while preserving closet and try-on functionality.

## Step 7 — Controlled Regional Rollout

### Context Brief

The PRD requires a dense regional supply before opening the marketplace. Launch only after Phase 1 quality and Lower Mainland/Fraser Valley inventory gates are met.

### Tasks

- Seed listings and free give-aways with verified pilot members and community partners.
- Start with invite-only annual memberships and capped credit grants.
- Monitor membership conversion, active listings, issuance, transfer, retirement, outstanding stock by cohort, median balance, concentration, credit velocity, implied item-price inflation, time to transaction, mode mix, completion, cancellation, dispute, fraud, give-away fulfillment, tax/reporting exceptions, and support load.
- Define circuit breakers for ledger imbalance, fraud spikes, low fulfillment, or insufficient inventory.
- Review pricing/allotment only through versioned membership terms; never silently revalue existing balances.

### Verification and Exit Criteria

- Phase 1 quality gate, defined active-closet gate, and minimum active-listing coverage by geography/category/size are met.
- Ledger reconciliation remains exact throughout the pilot.
- Pilot metrics meet thresholds approved in Step 1 before general availability.

### Rollback

Stop new memberships and offers through separate kill switches, stop renewals at each provider, honor or refund in-flight obligations under the approved terms, preserve required tax/audit records, and retain read-only balance/history/export access.

## Existing Backlog Impact

- Issues #27 and #30 must resolve entitlement migration and restricted tax/audit retention before subscription sales or deletion launch.
- Issues #36–#39 remain foundational but need credit/mode vocabulary, listing uniqueness, visibility, and reservation updates.
- Issues #40–#41 must replace CAD price/fee/`amount_cents` assumptions with discriminated credit, swap, and free-give-away contracts.
- Issues #42–#43 must cover private multi-mode negotiation and idempotent transaction notifications.
- Issue #44 must not simply disappear: close Stripe Connect only if the ADR rejects cash payouts, then replace it with approved billing and seller-compliance onboarding.
- Issue #45 must become balanced-ledger settlement instead of PaymentIntent capture.
- Issues #46–#47 remain necessary, expanded for credit reservations, swaps, give-aways, operator cases, and ledger disputes.
- Every affected issue remains blocked until it links the accepted ADR and revised canonical PRD/architecture.

## Explicit Non-Goals for the First Release

- Cash sales, seller payouts, commission, cryptocurrency, blockchain, credit cash-out, or direct credit gifting.
- Buying credit packs or mixing credits with cash.
- Multi-garment swaps, swap-plus-credit balancing, auctions, shipping labels, or international exchange.
- Algorithmically forcing a garment’s credit price.

## Success Measures

- Annual marketplace membership conversion and renewal intent.
- Active listing density and percentage accepting each mode.
- Credit issuance, transfer, retirement, outstanding stock, velocity, median balance, concentration, dormant stock, and implied price inflation.
- Offer-to-completion conversion and time to completed handoff.
- Percentage of members who both earn and spend credits.
- Free-give-away claim-to-handoff completion.
- Cancellation, dispute, fraud, and support-contact rates by mode.

## Adversarial Review Gate

The 2026-09-03 review concluded that this epic is not implementation-ready. The blueprint was revised so Step 1 must close four critical classes of risk before any engineering ticket can start:

1. Make the ADR and revised PRD/architecture canonical before cash-era marketplace tickets run.
2. Approve a separate iOS/Android/web billing topology for digital Pro, marketplace access, and physical-goods credits.
3. Approve Canadian tax valuation, collection/remittance, seller identification/reporting, and retained-record handling for credit exchanges and swaps.
4. Define refund/revocation after credits have been spent, including downstream innocent recipients and platform loss accounting.

The review also added double-entry controls, exhaustive state transitions, sanitized garment-copy semantics, anti-collusion measures, contractual wind-down, operator tooling, measurable rollout gates, account-deletion retention, Expo SDK 57 readiness, and a hard naming-clearance gate.

Reference policies to re-check at Step 1 because they can change:

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738)
- [CRA guidance for digital platform operators](https://www.canada.ca/en/revenue-agency/programs/about-canada-revenue-agency/cra/compliance/reporting-rules-digital-platforms/guidance-on-reporting-rules.html)
- [B.C. PST guidance for marketplace facilitators](https://www2.gov.bc.ca/assets/gov/taxes/sales-taxes/publications/pst-142-marketplace-facilitators.pdf)
