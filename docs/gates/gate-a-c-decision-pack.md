# Gate A-C decision pack: Fitly Credits, membership, and storefronts

**Prepared:** 2026-10-16

**Status:** recommendation for founder, legal, tax, accounting, and storefront review

**Scope:** invite-only British Columbia pilot

**Related authority:** GitHub #27, #48, #90; ADR 0001

**Not legal, tax, accounting, or App Review advice.** The named approvers must
record their decisions before production billing or a paid pilot is enabled.

## Executive recommendation

Fitly should copy the *mechanics* that make HomeExchange useful, not its point
amounts or price:

1. Keep three mutually exclusive settlement modes: a non-reciprocal transfer
   using Fitly Credits, a direct one-for-one swap using zero credits, and a free
   peer give-away.
2. Launch an invite-only B.C. pilot with **60 first-year credits** and **30
   renewal credits**. These are deliberately smaller than the previous
   500/250 development placeholders because garments have a very different
   supply, cadence, and unit value from overnight accommodation.
3. Let members earn credits only when another member receives their garment.
   Transfers do not create or destroy credits.
4. Do not expire earned, granted, or transferred credits. Do not sell credit
   packs, allow cash-out or gifting, permit negative balances, or combine cash
   and credits.
5. Keep the digital AI `pro` entitlement separate from the physical-exchange
   `marketplace_member` entitlement.
6. Do not ship a purchase button yet. The least risky implementation candidate
   is a consumption-only mobile app plus web membership, with no mobile
   purchase CTA, but Fitly's mixed access-and-physical-exchange value needs
   written Apple, Google, and Canadian counsel confirmation before that becomes
   the production rail.

The suggested annual price for research and approval is **CAD 59 plus applicable
tax**. This is not an approved price and must not replace the current no-charge
development activation. It intentionally remains inside the existing base
scenario so cost and willingness-to-pay research can compare a stable anchor.

## What the HomeExchange model actually establishes

HomeExchange currently charges USD 235 for twelve months, gives 500 GuestPoints
with the first membership, and gives 250 GuestPoints for an on-time renewal.
Those numbers belong to its accommodation economics; they are not a conversion
rate for Fitly. The useful pattern is the **2:1 first-year-to-renewal grant** and
the fact that the annual fee buys membership rather than individual stays.
Source: [HomeExchange membership benefits](https://help.homeexchange.com/hc/en-us/articles/360000610118-The-benefits-of-a-HomeExchange-membership).

GuestPoints enable non-reciprocal exchanges and transfer automatically when an
exchange is finalized. Reciprocal exchanges may use no points or only a points
difference. Most points are earned by hosting. Fitly can safely adapt those
mechanics to completed garment handoffs and zero-credit direct swaps. Sources:
[What are GuestPoints?](https://help.homeexchange.com/hc/en-us/articles/360000631237-What-are-GuestPoints) and
[reciprocal exchanges](https://help.homeexchange.com/hc/en-us/articles/360000621958-How-do-GuestPoints-work-for-reciprocal-exchange).

HomeExchange says exchange-earned GuestPoints do not expire. It also allows a
valid-cancellation resolution where the guest is refunded while the host keeps
their points. That second rule implies a platform-funded loss path instead of
clawing value back from an innocent party. Fitly should use that pattern only
through an audited dispute journal, never a silent balance edit. Sources:
[GuestPoint expiry](https://help.homeexchange.com/hc/en-us/articles/360001062358-Do-GuestPoints-expire) and
[guest cancellation treatment](https://help.homeexchange.com/hc/en-us/articles/360000619437-What-happens-when-I-am-a-guest-and-I-have-to-cancel-an-exchange).

### Confidence and limits

- **High confidence:** the current HomeExchange public mechanics above.
- **Medium confidence:** a 2:1 grant ratio is a suitable Fitly pilot hypothesis.
- **Low confidence until pilot data:** the absolute 60/30 amounts, CAD 59 price,
  and sustainable garment price distribution.
- HomeExchange's guarantees, mature inventory, support staffing, geographic
  density, and accommodation value are not evidence that the same numerical
  parameters will work for clothing.

## Gate A — proposed product and economy decisions

The founder may accept or replace each proposed value. “Approved” must include
the approver's name and date in the sign-off section; a merged document by
itself is not approval.

| Decision | Proposed pilot contract | Why |
| --- | --- | --- |
| Working customer-facing name | Fitly Credits | Clear and unambiguous for development. It is not the launch name until trademark, common-law, domain, App Store, bilingual, pronunciation, and confusion checks are attached and product signs the final-name field below. Internal code stays `market_credit`. |
| Annual fee | CAD 59 plus applicable tax | Existing base research anchor; low enough for a narrow pilot, but high enough that the full B.C. subscription obligations should be designed rather than avoided. |
| First paid membership grant | 60 credits, once per marketplace party | Conservative initial liquidity; preserves the HomeExchange 2:1 first/renewal pattern. |
| On-time renewal grant | 30 credits, once per successful renewal period | Limits automatic stock accumulation while rewarding renewal. |
| Late reactivation | 30 credits after a paid period starts; never another first-year grant | Prevents cancel/rejoin farming. |
| Earning | Listing owner earns the accepted price only after both parties confirm and settlement finalizes | Aligns issuance-free earning with a physical handoff. |
| Direct swap | One listed garment for one listed garment; zero credits | Keeps the reciprocal path independent from price differences in the first pilot. |
| Give-away | Zero credits; no charitable claim or tax receipt | Honest peer give-away rather than a regulated charity representation. |
| Listing price | Whole credits, 1-60; default suggestions of 5, 10, 15, 20, 30, 40 | Caps one item at the initial grant and creates observable pricing bands. The owner may choose within bounds. |
| Credit expiry | None | Consistent with the safer consumer contract and with the HomeExchange earned-point pattern. |
| Cash properties | No cash value, cash-out, pack sale, gifting, peer transfer outside settlement, or negative balance | Keeps the pilot a closed loop and reduces abuse and policy ambiguity. |
| Account limit | One marketplace party and one first-year grant per verified person; linked accounts require operator review | Prevents repeated onboarding grants without silently merging balances. |
| New-account hold | Grant is available immediately; listings/offers require completed profile and verified email; operator may freeze—not erase—value through an audited case | Supports onboarding without client-authored balance changes. |
| Membership lapse | Browse, retain balance, read history/chat, confirm or dispute an already accepted handoff, and finish account deletion. Cannot create a new listing/offer, accept an offer, or start a new transaction. | Existing obligations remain recoverable while new value-creating actions stop. |
| Billing grace | Keep the entitlement active only while the provider reports an active billing-grace period. Do not issue the renewal grant until payment recovery succeeds. If grace ends unpaid, apply lapse behavior at the provider effective time. | Avoids granting new value before a successful renewal while respecting provider recovery state. |
| Subscription cancellation | Cancellation stops automatic renewal and takes effect at the paid period end. Access and the period's valid grant remain until then unless the provider issues a refund or revocation. | Separates turning off renewal from reversing a paid period. |
| Restore | Server fetches or receives authoritative provider history and replays normalized events. Restore never activates directly from the client and never creates a second grant for the same provider period. | Makes reinstall and device change idempotent. |
| Family sharing | Disabled for marketplace membership. Each participant needs an individual adult account and marketplace party. | Credits, identity, safety history, and seller obligations are person-specific. |
| Account merge | No automatic balance or identity merge. Freeze the duplicate account's new transactions, verify common ownership, preserve party/journal provenance, select one surviving login, and use a dual-approved migration that cannot duplicate a first-year grant. | Avoids destroying audit identity or combining grants silently. |
| Accepted transaction at lapse | Terms and eligibility are snapshotted at acceptance; both parties may complete, cancel where allowed, or dispute | Avoids stranding a physical handoff because a renewal date passed. |
| Cancellation before acceptance | Withdraw/reject; release reservations exactly once; no transfer | No completed physical exchange. |
| Cancellation after acceptance but before either confirmation | Either party may cancel; release credits and listings exactly once | Current development contract. |
| Cancellation after one confirmation | Freeze and open a dispute; no automatic release or settlement | Prevents one party from undoing a possibly completed handoff. |
| Valid no-fault dispute resolution | Where policy approves refunding the acquirer while protecting an innocent provider, post a balanced platform-loss journal | Adapts HomeExchange's compassionate cancellation pattern without rewriting history. |
| Membership refund before any grant spend/reservation | Revoke unused grant through a reversal journal, then refund through the approved provider | Avoids orphaned issued value. |
| Refund after any grant spend/reservation | No automatic clawback. Freeze new transactions and route to operator resolution under counsel-approved terms | A refund must not create a negative balance or take earned value from another member. |
| Chargeback/provider revocation | Same as refund: idempotent provider event, no balance rewrite, operator case if value moved | Preserves accounting and innocent counterparties. |
| Wind-down | Disable new grants/offers/acceptance first; allow completion/cancellation/dispute/history; notify members; preserve balances and records for the counsel-approved period | Production shutdown must not abandon accepted handoffs or erase audit history. |

### Gate A economy thresholds and circuit breakers

The prior three-year scenarios show that transfer volume does not retire
credits; every grant increases outstanding stock. The 60/30 proposal therefore
ships only with these pilot controls:

- maximum automatic grant issuance: 60 on the first paid period and 30 per
  later paid period, enforced by cohort and provider-event idempotency;
- no operator-created grants except a dual-approved, reason-coded adjustment;
- freeze new grants if reconciliation is not exactly balanced, if provider event
  lag exceeds the approved SLA, or if any grant cohort duplicates;
- monthly review of the exact metrics below;
- no increase to grants or price bounds until at least two complete monthly
  cohorts have enough active supply by region, category, and size;
- no credit burn introduced merely to improve metrics; any expiry, fee, or
  retirement mechanic requires a new legal conclusion and ADR amendment.

The following are proposed Gate A values. Product and finance must accept or
replace every number before Gate A closes. Measurements begin with the first
paid cohort; a directional decision requires at least 100 paid member-periods,
60 completed handoffs, and two complete calendar months. Reconciliation and
duplicate-grant controls apply immediately and do not wait for a sample.

| Metric | Formula and window | Proposed pass value | Circuit breaker | Owner |
| --- | --- | --- | --- | --- |
| Ledger imbalance | Absolute difference between all debit and credit postings, checked continuously and in a daily reconciliation | Exactly 0 credits | Disable new grants, offers, and acceptance immediately; keep recovery/history available | Finance + engineering |
| Duplicate grant rate | Provider periods with more than one effective first/renewal grant ÷ provider periods, daily and monthly | Exactly 0% | Disable new grants and reconcile through immutable reversals | Finance + engineering |
| Outstanding credits per active paid member | Month-end member-held available + reserved credits ÷ active paid members | At most 90 | Stop new paid enrollment and discretionary adjustments; honor already-contracted periods while product reviews grant size | Product + finance |
| 30-day transfer velocity | Credit amount settled in trailing 30 days ÷ average daily member-held outstanding credits | At least 0.08 after the minimum sample | Stop expanding the pilot after two consecutive failed months and reassess grant and price bounds | Product |
| 60-day initial-grant utilization | First-year credits spent or reserved within 60 days ÷ first-year credits granted to eligible mature cohorts | At least 30% | Stop expanding the pilot after two consecutive failed cohorts | Product |
| Dormant balance share | Credits held by parties with no listing, offer, or settlement activity for 90 days ÷ member-held outstanding credits, monthly | At most 40% | Stop expansion and research inactivity; do not expire or fee balances | Product + finance |
| Top-1% concentration | Credits held by the highest-balance 1% of eligible members ÷ member-held outstanding credits, monthly | At most 20% | Freeze suspicious accounts only through audited cases; stop discretionary grants and investigate | Risk + finance |
| Platform-loss ratio | Credits issued through dispute/refund protection journals ÷ credit volume settled, trailing 90 days | At most 3% | Stop expansion and review abuse, policy, and evidence handling | Risk + finance |
| Variable cost per paid member-year | Store/payment fees + AI + notifications + moderation + support + fraud/platform loss, excluding tax and fixed corporate overhead, ÷ paid member-years, trailing 90 days annualized | At most CAD 35 and at least 40% contribution margin at the approved fee | Stop expansion and re-price only after a new approved disclosure/store review | Product + finance |

Gate E separately owns inventory-density, moderator capacity, response-time,
reliability, and regional safety thresholds. It may use the same observations,
but it cannot approve or replace the Gate A economic values above.

## Gate B — questions requiring written Canadian approval

These are classification and policy questions, not conclusions in this report.

1. **Stored value.** B.C.'s current statute defines a prepaid purchase card
   around monetary value issued or sold for future goods/services and generally
   prohibits expiry and related fees, with disclosure requirements and possible
   regulatory exceptions. Counsel must decide whether a membership grant,
   earned credit, or both fall inside that definition. Source:
   [B.C. Business Practices and Consumer Protection Act, Part 4.1](https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/04002_05).
2. **Automatic renewal.** The proposed CAD 59 cumulative price exceeds the
   page's CAD 50 scope threshold and a yearly renewal exceeds 60 days. Consumer
   Protection BC describes cancellation at any time, a 30-to-60-day renewal notice, a
   usage-based refund where eligible, refund within 15 days, and no further
   charges after cancellation. Counsel must approve the contract, notice copy,
   cancellation channel, and refund formula. Source:
   [Consumer Protection BC subscription contracts](https://www.consumerprotectionbc.ca/consumer-help/subscription-contracts/).
3. **Barter/GST/HST.** CRA treats barter as two supplies valued at fair market
   value and separately describes administered barter-unit networks. Counsel
   and a tax adviser must determine whether Fitly, casual members, business
   sellers, or particular transactions have registration, valuation, tax, or
   designation consequences. Source:
   [CRA GST/HST special cases](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-special-cases.html).
4. **Digital-platform reporting.** CRA guidance says non-fiat consideration,
   including barter, is reported at a reasonable and consistently determined
   Canadian-dollar fair market value when the reporting rules apply. Fitly
   knows listing prices, parties, and settlement events, so it should not assume
   it qualifies as software used exclusively to list or advertise. A tax adviser
   must decide operator scope, excluded sellers, due diligence, amendments,
   retention, and the valuation method. Source:
   [CRA digital platform operator guidance](https://www.canada.ca/en/revenue-agency/programs/about-canada-revenue-agency-cra/compliance/reporting-rules-digital-platforms/guidance-on-reporting-rules.html).
5. **B.C. PST.** Review the final membership, marketplace-service, and payment
   flows against [B.C. PST 142](https://www2.gov.bc.ca/assets/gov/taxes/sales-taxes/publications/pst-142-marketplace-facilitators.pdf).
   The current no-cash member settlement does not by itself prove that Fitly is
   or is not a marketplace facilitator.
6. **Consumer and safety terms.** Approve title, counterfeit/recall/hygiene
   exclusions, condition mismatch, meetup safety, no-shows, evidence limits,
   resolution outcomes, appeal, operator access, takedown, and retention before
   public listings.

### Required Gate B deliverables

- signed Canadian/B.C. legal memorandum;
- signed tax/accounting memorandum with worked credit, swap, and give-away
  examples;
- approved membership and marketplace terms plus privacy/retention schedule;
- approved dispute/evidence, report/block, takedown, and appeal policy;
- explicit answer on what data is required for seller/platform reporting and
  when collection becomes mandatory;
- approved wind-down and dormant-balance treatment.

## Gate C — storefront decision and recommended request

### Why the rail is unresolved

Apple generally requires in-app purchase for digital functionality and says
IAP-purchased credits may not expire. It separately requires non-IAP methods for
physical goods consumed outside the app and allows a free companion app without
purchase or external-purchase calls to action. Fitly's annual membership mixes
access to app transaction features with credits used for physical garments, so
none of those general rules alone classifies the whole SKU. Source:
[Apple App Review Guidelines 3.1](https://developer.apple.com/app-store/review/guidelines/).

Google Play likewise requires Play billing for digital subscriptions and sold
virtual currency, excludes physical goods and peer-to-peer payments, and allows
earned or awarded points without Play billing. Its guidance says mixed SKUs
whose value is more digital than physical require Play billing, while a
consumption-only app cannot sell any product or service in the app. Sources:
[Google Play Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738) and
[Payments policy explainer](https://support.google.com/googleplay/android-developer/answer/10281818).

### Recommended submission position

Ask both storefronts to review this exact first-release contract:

- one annual marketplace membership;
- one first-year or renewal grant, never a separately sold pack;
- credits earned only through completed physical garment handoffs;
- credits redeemable only for other members' physical garments;
- zero-credit swaps and give-aways;
- no cash sale, seller payout, commission, shipping, auction, digital content
  purchase, credit gift, or cash-out;
- separate optional digital AI Pro subscription, never bundled with marketplace
  membership;
- proposed web checkout with mobile apps in consumption-only mode, displaying
  membership state but no purchase link or mobile CTA.

Request a written answer on whether the marketplace membership may use web
billing with consumption-only iOS/Android apps, whether it must use a store
subscription, or whether the grant must be removed from the paid SKU. Keep the
production purchase switch off until both answers and counsel's classification
are attached to the issue.

### Fallbacks, in order

1. **Approved consumption-only mobile + web membership.** Implement a web
   provider, provider-neutral entitlement events, renewal notices, cancellation,
   and mobile restore by server session. No purchase CTA in the apps.
2. **Store-required marketplace subscription.** Implement separate StoreKit and
   Play subscription SKUs only if both stores explicitly accept the physical
   credit benefit. Keep the web entitlement behavior equivalent and grants
   idempotent across providers.
3. **Unbundle the grant.** If the membership SKU cannot combine access and
   credits, charge only for approved membership services and let all credits be
   earned/awarded independently under the reviewed rules.
4. **No paid membership in the pilot.** Continue a no-charge, invite-only pilot
   until evidence supports a compliant paid model.

Fitly must not silently choose different rails to exploit a policy gap. Each
storefront can have different purchase UI, but the member contract, entitlement
state, journal, refund safety, and disclosure must remain coherent.

### Required selected storefront matrix

Store responses are evidence, not the product decision. After receiving them,
product, legal, and finance must select exactly one compatible topology and
complete every cell below. “TBD,” multiple selected fallbacks, or conflicting
rails leave Gate C open.

- [ ] **Selected topology:** consumption-only mobile + web membership
- [ ] **Selected topology:** StoreKit + Play subscription + approved web equivalent
- [ ] **Selected topology:** paid membership unbundled from independently awarded/earned credits; this selection reopens Gate A and requires a replacement grant/economy contract signed before C19
- [ ] **Selected topology:** no paid membership; no-charge invite-only pilot; this selection leaves C19 and C20 blocked

Exactly one box above must be selected.

| Required decision | Approved value |
| --- | --- |
| iOS rail and SKU topology | __________ |
| iOS purchase/restore/manage/cancel CTA behavior | __________ |
| Android rail and SKU topology | __________ |
| Android purchase/restore/manage/cancel CTA behavior | __________ |
| Web rail, provider, and SKU topology | __________ |
| Cross-provider account ownership and duplicate-purchase behavior | __________ |
| Price/tax, period, automatic-renewal, grant, no-cash-value, cancellation, refund, restore, Terms, Privacy, and support disclosures | __________ |
| Stop-renewal action for each provider | __________ |
| Stop-new-purchase action for each provider and storefront | __________ |
| Existing-member access, balance, open-transaction, refund, export, retention, and notice behavior during wind-down | __________ |
| Evidence that Apple, Google, counsel, and the selected web provider accept the same contract | __________ |

Gate C closes only when the selected matrix is signed by product, legal, and
finance, the final customer disclosures are attached, and each provider has an
executable stop-sale/stop-renewal/wind-down action. Provider credentials and
live SKU identifiers may remain Gate D, but their topology and operational
actions may not remain undecided. Selecting the unbundled topology invalidates
the proposed paid-period 60/30 grant contract and therefore reopens Gate A until
a replacement is signed. Selecting the no-paid topology can close Gate C only
for the no-charge pilot; it does not authorize C19 or C20.

## Provider-neutral engineering contract after approval

Only a fully completed and signed Gate A paid product contract, Gate B lifecycle
and retention conclusions, and a Gate C paid storefront matrix authorize C19.
The no-paid topology leaves C19 and C20 blocked. The unbundled topology requires
a replacement Gate A contract before C19. C20 additionally requires the Gate D
provider accounts and credentials:

1. Store immutable normalized provider events with provider, event ID, product,
   original transaction/customer ownership, effective period, status, and a
   redacted raw-event reference.
2. Derive `marketplace_member` entitlement periods on the server. Clients never
   activate membership or grants directly.
3. Issue the cohort grant once for a successful first or renewal period using a
   stable provider-period idempotency key.
4. Treat duplicate, delayed, and reordered purchase, renewal, grace, refund,
   revocation, and chargeback events as replayable inputs to the same result.
5. Never delete or mutate journal history; correct with balanced reversals.
6. Keep browsing, history, confirmation, dispute, deletion, and provider restore
   available according to the lapse contract above.
7. Require a provider-operable stop-renewal and wind-down runbook before a
   production checkout flag can be enabled.

## Decision record

The following must be completed by humans with the stated authority. A blank
box is a hard launch block.

- [ ] **Founder/product + finance:** accept or replace every Gate A lifecycle
  value and every numeric economy threshold, including fee, grants, bounds,
  samples, targets, and circuit breakers.
  Names: __________ Date: __________ Evidence/link: __________
- [ ] **Founder/product:** approves the final launch credit name after the
  required clearance checks.
  Final name: __________ Date: __________ Evidence/link: __________
- [ ] **Canadian legal counsel:** approves the classification, consumer terms,
  subscription/refund, stored-value, safety, dispute, privacy, retention, and
  wind-down conclusions.
  Name: __________ Date: __________ Evidence/link: __________
- [ ] **Canadian tax/accounting adviser:** approves GST/HST, PST, digital-platform
  reporting, fair-market-value, seller due-diligence, amendment, and retention
  treatment.
  Name: __________ Date: __________ Evidence/link: __________
- [ ] **Apple:** written classification or accepted review position attached.
  Case/build: __________ Date: __________ Evidence/link: __________
- [ ] **Google Play:** written classification or accepted review position
  attached.
  Case/build: __________ Date: __________ Evidence/link: __________
- [ ] **Product + legal + finance:** select and sign the single final storefront
  matrix, disclosures, and provider wind-down actions above.
  Names: __________ Date: __________ Evidence/link: __________
- [ ] **Security/privacy owner:** approves provider-event retention, restricted
  identity access, operator roles, and audit controls.
  Name: __________ Date: __________ Evidence/link: __________

## Stop conditions

Production billing and a paid pilot remain disabled if any of the following is
true:

- any sign-off above is absent or conditional;
- the Apple, Google, web, and counsel decisions disagree on the same SKU;
- refunds or revocations can produce a negative balance or claw back another
  member's earned credits;
- the provider cannot stop renewal or replay events safely;
- the journal does not reconcile exactly;
- mandatory disclosures, cancellation, tax, reporting, retention, support, or
  dispute operations are not ready;
- the implementation differs from the reviewed contract.

## Research method and residual gaps

This pack applies ECC deep-research practice: current first-party sources were
preferred, facts are separated from Fitly recommendations, and uncertainty is
called out. Sources were re-checked on 2026-10-16. Store policies and statutes
can change; approvers must re-check them at sign-off and release.

Remaining gaps cannot be resolved by source code alone: actual willingness to
pay, real supply/demand distributions, Apple and Google classification of the
mixed SKU, legal characterization of each credit cohort, Canadian tax/platform
reporting scope, and named operational owners. Until those are evidenced, this
document narrows the decision but does not clear the gate.
