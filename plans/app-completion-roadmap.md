# Fitly App Completion Roadmap

**Status:** ECC-reviewed; execution in progress (C01-C05 merged; C07 implementation and verification in progress; C06 waits on External Gate B)

**Created:** 2026-10-15

**Planning workflow:** ECC Blueprint + Production Audit

**Authority:** GitHub issues and merged code are authoritative; this document is the execution map

**Target:** invite-only regional production pilot, followed by public launch only after external gates are approved

## Objective

Finish the current Fitly product scope as a reliable Expo SDK 57 application: private closet, AI garment processing and try-on, a safe peer marketplace using annual membership and Fitly Credits, direct swaps and give-aways, production operations, and verified iOS/Android release paths.

“Complete” in this roadmap means every in-scope journey is implemented, secured, tested end to end on real devices, observable, recoverable, documented, and releasable. It does not mean adding every possible future marketplace feature.

## Current Baseline

The repository already contains:

- Expo SDK 57 application foundations, authentication, adult eligibility, onboarding, privacy controls, account deletion, English/Brazilian Portuguese localization scaffolding, and error recovery.
- Private body photos with Gemini validation, private garment capture and processing, category suggestions, private AI try-on jobs, quota control, realtime recovery, saved results, feedback, and sharing.
- A development marketplace with no-charge membership activation, credit balance/history, listing modes, offers, listing reservation, private chat, dual handoff confirmation, cancellation, relisting safety, and credit settlement.
- Supabase migrations, RLS policies, pgTAP tests, Jest tests, PII checks, Expo Doctor, web export, and GitHub Actions workflows.
- C01 reproducible quality gates with marketplace coverage, locked SDK 57 tooling, adult-media RLS hardening, and two consecutive green CI runs.

Known baseline failures and gaps:

- Marketplace account deletion now separates private erasure from pseudonymous retained accounting records; scheduled retention expiry and backup re-deletion still wait on the approved Gate B policy.
- Abandoned reservations do not expire automatically and acquired garments are not copied into the recipient’s closet.
- Disputes, reports, blocks, ratings, production moderation, operator tools, and push notifications are missing.
- Marketplace proximity is not backed by privacy-preserving geospatial search.
- Real billing, renewals, restore/refund/revocation behavior, store policy approval, and final economic parameters are not approved or implemented.
- The Gemini project still needs funded real-image validation; optional garment cleanup lacks a production credential; marketplace try-on is incomplete.
- Social OAuth, full localization, external crash reporting, production EAS credentials, store release setup, and full two-device E2E verification are incomplete.
- The Jest coverage gate does not currently collect `src/features/marketplace`, so a green report can omit launch-critical marketplace code.

## Definition of Complete

The target is complete only when all of these are true:

1. Main-branch CI is green and reproducible locally without unsafe dependency downgrades or ignored critical production advisories.
2. Credit, swap, and give-away journeys complete on two real accounts and two devices without manual database intervention.
3. Every reservation, cancellation, timeout, confirmation, dispute, refund, and retry is server-authoritative, idempotent, auditable, and cannot strand a garment or credit balance.
4. Users can report and block, moderators can resolve cases with least privilege, and marketplace launch kill switches are tested.
5. Account deletion removes private content while preserving only the records required by the approved retention policy.
6. Paid membership grants credits exactly once across purchase, renewal, restore, refund, revocation, duplicate, delayed, and reordered provider events.
7. AI flows succeed with representative real images, fail safely without provider spend or data leakage, and expose actionable user recovery.
8. English and Brazilian Portuguese journeys, accessibility, offline/retry states, loading/empty/error states, and common screen sizes pass QA.
9. Production builds, secrets, deep links, OAuth redirects, privacy disclosures, monitoring, rollback, incident handling, and support paths are documented and exercised.
10. Required product, legal, tax, storefront, privacy, and regional launch approvals are recorded; no external gate is represented as an engineering completion.

## Scope Guard

The first launch excludes cash sales, seller cash-out, purchasable credit packs, credit gifting, mixed credit/cash offers, shipping, auctions, multi-item swaps, charitable-receipt claims, and anonymous marketplace discovery. These require a later approved ADR.

## Dependency Graph

```text
Step 1 Engineering baseline + native device-test foundation
  └── Step 2 Pseudonymous party + double-entry ledger contracts
        ├── Step 3 Account deletion + retention architecture
        │     └── Step 4 Settlement lifecycle completion
        └── Step 5 Geospatial discovery foundation

Step 1 ──> Step 6 Notification infrastructure
Steps 3–6 ──> Step 7 Safety + disputes + final notification events
Step 4 ──> Step 8 Marketplace try-on + AI completion
Steps 4, 7, 8 ──> Step 9A Localization/accessibility foundations

External Gates A–C ──> Step 10 Production membership billing
External Gate B ──> Step 11 Seller compliance + operations
Steps 10–11 ──> Step 9B Final cross-feature language/accessibility audit
Steps 9B–11 ──> Step 12 Production release and rollback path
Steps 2–12 ──> Step 13 Full E2E, recovery drill, and regional pilot gate
```

Safe parallelism is limited to contracts that do not share migrations or state ownership: notification outbox infrastructure may proceed after the native test foundation, and coarse geospatial schema may proceed after the party contract. Notification event integration, block-aware discovery, translated final copy, and device acceptance wait for the states they expose.

## External Gates

These tracks start immediately but may not be completed by code alone:

| Gate | Required output | Blocks |
| --- | --- | --- |
| A. Economy | Final annual price, first/renewal grant, pricing bounds, lapse, refund/revocation, wind-down, final credit name, and measurable cost/liquidity thresholds | Step 10 paid membership; paid staging and launch |
| B. Legal/tax/privacy | Approved terms, retention/destruction schedule, barter/platform reporting and seller-due-diligence requirements, dispute/evidence policy, takedown process | Step 3 final retention schema, Step 7 dispute policy, Step 11 compliance tooling, any production pilot |
| C. Storefront | Written iOS, Android, and web payment-rail decision; approved product disclosures and provider-operable wind-down actions | Step 10 billing; paid mobile launch |
| D. Accounts and credentials | Apple Developer, Google Play, EAS/Expo token, OAuth credentials, funded Gemini project, optional cleanup-provider decision | Signed device builds, OAuth, push, real-provider smoke tests, store submission |
| E. Pilot operations | Named moderator/support owner, monitored contact addresses, pilot users, SLA, reliability/safety/density thresholds, and circuit-breaker owners | Step 13 regional pilot |

While a gate is pending, its feature remains behind development mode or a server-side kill switch. Other independent steps continue.

Before pilot approval, owners must commit numeric thresholds and measurement windows for crash-free sessions, API/Edge Function success, stale reservations, ledger imbalance, notification delivery latency, AI success/latency/cost, dispute and report response time, fraud loss, marketplace inventory density by region/category/size, and support capacity. Step 13 verifies those exact values; it does not invent them during release review.

## One-PR Execution Slice Register

The numbered steps below are milestones. Execution occurs through these smaller, independently reviewable PR slices. Each slice must be attached to the named issue or to a replacement issue created during C01; “new” does not authorize implementation without an issue link.

| Slice | Scope and primary targets | Prerequisite | GitHub authority | Exit evidence |
| --- | --- | --- | --- | --- |
| C01 | CI/advisory remediation, deterministic Supabase CI, marketplace coverage ownership; `.github/workflows`, `package*.json` | none | #67 | Two consecutive green CI runs; marketplace included in coverage |
| C02 | Minimal EAS dev-client/staging profiles and seeded two-account device harness; `app.json`, `eas.json`, E2E config | C01, Gate D for signed builds | #34 rewrite | Verified in an installed SDK 57 iOS simulator build with an idempotent two-account seed and Maestro smoke; signed physical build remains Gate D/C24 |
| C03 | Pseudonymous marketplace party identity and FK migration; `supabase/migrations` | C01 | #48 + #71 | Forward migration/RLS tests; old data backfilled |
| C04 | Double-entry account/journal/posting/cohort/reversal foundation and reconciliation | C03, Gate A for final cohort policy | #48 + #73 | Balanced journal and concurrency pgTAP tests |
| C05 | Deletion tombstone, write barrier, durable checkpoints, private-media purge | C03, C04, Gate B retention rules | #30 replacement/new issue | Deletion races with uploads/workers safely |
| C06 | Retention expiry/hold release, backup re-deletion, purge evidence | C05, Gate B | same as C05 | Scheduled purge and restore/re-delete drill |
| C07 | Offer/transaction state contract, timeout policy, immutable snapshots, kill-switch semantics | C04, C05 | #41 | State transitions and deletion tombstone races tested |
| C08 | Expiry worker and exactly-once reservation/credit release | C07 | #46 rewrite | Time-travel/concurrency tests; no stranded state |
| C09 | Sanitized acquired-garment copies for credit/swap/give-away settlement | C07 | #46 rewrite | All three modes populate recipient closets once |
| C10 | Push token lifecycle and notification outbox/provider adapter | C02 | #43 rewrite | Device push/token rotation tests |
| C11 | Marketplace event notification/deep-link integration | C07, C10, C15 | #43 | Idempotent safe-copy delivery for all final states |
| C12 | PostGIS coarse geography and authenticated nearby RPC | C03 | #36/#37 rewrite | RLS/radius/precision tests |
| C13 | Listing moderation/takedown pipeline and real filter/pagination queries | C12, Gate B takedown rules | #37/#38 rewrite | Moderated listings excluded; filters are server-backed |
| C14 | Report/block primitives and block-aware discovery/contact | C03, C13, Gate B | #47 rewrite | Authorization/abuse tests |
| C15 | Dispute state machine, evidence boundary, settlement freeze and resolutions | C07, C14, Gate B | #46/#47 rewrite | Every resolution reconciles exactly once |
| C16 | Ratings plus least-privilege operator case tools and audited dual approval | C15, Gate E operator | #47 rewrite | Operator drill and anti-retaliation tests |
| C17 | Real-provider AI smoke, marketplace try-on privacy, color suggestions, circuit breakers | C02, C09, Gate D Gemini | #39 rewrite + new AI issue | Real-image staging evidence and privacy tests |
| C18A | Localization catalog/language selector, common accessibility primitives, shared loading/error/offline states | C11, C13, C16, C17 | new product-quality issue | Shared EN/PT-BR and accessibility foundations pass |
| C19 | Provider-neutral entitlement event contract and server membership lifecycle | C04, Gates A–C | #27/#48 rewrite | Duplicate/reordered/refund fixtures reconcile |
| C20 | Store/provider adapters, live disclosure UI, sandbox purchase/restore/cancel | C19, Gate D store credentials | #27 | Store sandbox device evidence |
| C21 | Conditional seller due diligence, restricted identity, valuation/reporting/receipts | Gate B decision, C03, C04 | replacement for #44 | Approved reporting fixtures and access audit |
| C22 | OAuth/account-linking/reauthentication | C02, Gate D OAuth | new identity issue | Real-device link/revoke/collision tests |
| C23 | Redacted crash monitoring, health/reconciliation alerts, support runbooks | C01, C04 | new operations issue | Synthetic incident and privacy tests |
| C18B | Final cross-feature i18n/accessibility/visual-state audit including billing, seller compliance, and OAuth | C18A, C20, C21, C22 | same product-quality issue | Launch-critical EN/PT-BR and accessibility acceptance |
| C24 | Production EAS profiles, signing, runtime/min-version compatibility, OTA/rollback | C02, C18B, C19–C23 | new release issue | Production-candidate builds and rollback drill |
| C25 | Accumulated Maestro suites, two-device acceptance, security/performance/recovery | C05–C17, C18B–C24 | #34 rewrite | Full green release evidence and reconciliation |
| C26 | Regional pilot decision, issue closure by evidence, docs/ADR release sync | C25, Gates A–E | #48 epic | Signed pilot gate; only reconciled issues closed |

All code slices use the strongest available review for schema, ledger, deletion, payment, authorization, and release-boundary changes; routine UI/test implementation may use the default model but must pass the same ECC verification gates.

---

## Step 1 — Restore a Trustworthy Engineering and Device-Test Baseline

### Context brief

Main is currently functionally tested but CI is red. The dependency job reports a critical transitive `shell-quote` advisory, while the database job has failed during Supabase container pulls. Every later change needs a reliable signal, so this is the first implementation slice.

### Tasks

- Read and follow the exact Expo SDK 57 documentation before changing Expo packages.
- Trace every critical/high advisory to runtime or development-only dependency paths and apply only SDK-57-compatible upgrades, package overrides, or documented risk exceptions with expiry and owner.
- Keep the production audit gate meaningful; do not use `npm audit fix --force`, an Expo downgrade, or a blanket ignore.
- Make Supabase CI deterministic by pinning tested tooling/images and handling registry pull instability without skipping RLS tests.
- Add a reproducible local `quality` command that matches CI and reports each gate separately.
- Include `src/features/marketplace` and every new worker/provider module in enforceable coverage ownership; use executable pgTAP concurrency assertions rather than source-pattern checks.
- Establish the minimal Expo SDK 57 development-build/staging foundation and a seeded two-account E2E harness before push, OAuth, or billing acceptance. SDK 57 targets React Native 0.86, React 19.2.3, Node 22.13.x minimum, Android 7+/API 36, and iOS 16.4+/Xcode 26.4+; Android remote push requires a development build rather than Expo Go.
- Reconcile GitHub issues #27 and #34–#48: close implemented slices, rewrite stale cash/Stripe assumptions, and create missing issues linked to the steps below.

### Verification and exit criteria

- `npm ci`, typecheck, coverage, PII check, Expo Doctor, web export, production audit, and pgTAP all pass from a clean checkout.
- Two consecutive main-branch CI runs pass.
- An installable staging development build completes one seeded two-account smoke path on a physical device where credentials are available.
- No open issue claims a completed capability is still wholly missing, and every remaining roadmap step has one authoritative issue or epic link.

### Rollback

Revert only the dependency/CI or development-build change that broke compatibility; retain issue corrections and the audit evidence. Never relax a security gate without a dated, owned exception.

---

## Step 2 — Establish Pseudonymous Party and Double-Entry Ledger Foundations

### Context brief

Settlement, deletion, disputes, billing, and seller compliance all depend on durable party identity and auditable value movement. The development prototype’s per-user ledger cannot be replaced after those consumers are built. This milestone establishes provider-neutral contracts before transaction-specific work; final payment adapters remain in Step 10.

### Tasks

- Add pseudonymous marketplace-party identifiers so retained transaction/accounting records do not depend directly on a live public profile or Auth identity.
- Migrate/backfill existing marketplace records through forward-only migrations with explicit compatibility windows for old app versions.
- Add accounts, journals, balanced postings, grant cohorts, pending/available/held/escrow/platform accounts, immutable reversals, provider-event ownership, and idempotency constraints.
- Provide server-only grant/reserve/release/reverse/adjust operations and owner-only balance/history reads; clients never write balances or terminal postings.
- Add reconciliation from membership grant through reservation and settlement, plus imbalance alerts and dual-approval boundaries for future manual adjustments.

### Verification and exit criteria

- Every journal is balanced, every mutation is idempotent, and concurrent reservations cannot overdraw available balance.
- Existing development memberships, credits, offers, and transactions backfill without loss or duplicate value.
- RLS prevents members from reading another member’s total balance, restricted party record, or platform accounts.

### Rollback

Disable new grants/reservations while retaining read/reconciliation access. Use a forward correction migration; never delete or rewrite immutable journal history.

---

## Step 3 — Make Account Deletion Compatible With Marketplace Records

### Context brief

The current full-delete flow predates marketplace tables whose foreign keys preserve financial and transaction history. A marketplace participant can therefore be unable to delete the account or the system can delete records that later prove necessary. The final retention durations depend on External Gate B, but the technical boundary can be built around a versioned retention policy.

### Tasks

- Write an ADR separating deletable private content from restricted transaction, fraud, moderation, tax, and audit records.
- Use the internal pseudonymous party reference from Step 2 and prevent retained records from exposing deleted-profile data.
- Build one idempotent deletion orchestration path covering Storage objects, body photos, garments, try-on results, messages, public profile/listings, auth identity, retained records, and interrupted retries.
- Define what happens to pending offers, reservations, handoffs, disputes, and balances before deletion can finish.
- Add export/retention metadata, legal-hold behavior, operator visibility boundaries, and audit events without storing unnecessary private content.
- Add a deletion tombstone/write barrier so in-flight AI workers, settlement calls, notification jobs, billing events, and uploads cannot recreate personal data after deletion begins.
- Add scheduled destruction at retention expiry, legal-hold release, durable purge checkpoints, backup/restore re-deletion, and evidence that removable media is not retained inside transaction snapshots.

### Verification and exit criteria

- A user with no marketplace history, a completed transaction, an active reservation, and an open dispute each receives the approved deterministic deletion result.
- Retried deletion is idempotent, private Storage access is removed, no personal profile is discoverable, and required retained records still reconcile.
- Races with settlement, provider events, uploads, AI results, purge jobs, backup restore, and legal-hold release cannot resurrect private content or corrupt retained records.
- pgTAP and Edge Function tests prove RLS and least-privilege access for deleted-party records.

### Rollback

Keep public deletion disabled only for accounts with unresolved marketplace state, show an honest support path, and retain the existing deletion path for accounts without marketplace history until the migration is verified.

---

## Step 4 — Complete Settlement, Expiry, and Closet Transfer Semantics

### Context brief

The development loop reserves credits/listings and completes dual-confirmed handoffs, but abandoned state can remain forever and recipients do not receive a clean closet record. This step completes the core transaction state machine before more marketplace surfaces depend on it.

### Tasks

- Specify the offer and transaction state machines, actors, timeouts, terminal states, idempotency scopes, and ledger/listing effects.
- Add scheduled expiry for stale offers, unconfirmed reservations, and abandoned handoffs; release credits and listings exactly once.
- On completion, archive the seller’s listing/garment and atomically create a sanitized acquired-garment copy for the recipient; create two copies for a swap.
- Add immutable listing/offer/terms snapshots and separate feature kill switches for grants, offers, acceptance, and settlement on top of the Step 2 journal contracts.
- Enforce the existing `transactions_enabled` configuration server-side.
- Add reconciliation queries for reserved credits, active listings, transaction state, and acquired garments.

### Verification and exit criteria

- Concurrency tests cover competing buyers, competing swaps, duplicate accept/confirm/cancel/expire calls, process failure, and retry.
- Settlement, expiry, and acquired-copy calls racing an account-deletion tombstone cannot recreate private content, settle against a deleted identity, or release a physically handed-over/disputed exchange incorrectly.
- No tested path creates a negative balance, duplicate acquired garment, double transfer, orphan reservation, or unavailable listing after release.
- Credit, swap, and give-away completion each place the expected garment in the recipient closet.

### Rollback

Disable new acceptance and settlement while keeping reconciliation, history, and state-specific recovery operational. A kill switch must not auto-release a listing or held credits after a physical handoff or during a dispute; those cases stay frozen for the approved recovery path. Correct schema through forward migrations only.

---

## Step 5 — Implement Privacy-Preserving Nearby Discovery and Listing Moderation

### Context brief

Marketplace listings currently use free-text pickup areas and visual distance placeholders. The target needs useful regional discovery without exposing a member’s exact home or meetup location.

### Tasks

- Add PostGIS-backed coarse member/listing geography, server-side distance calculation, and an authenticated `listings_nearby` RPC.
- Store only the minimum precision required for discovery; never return raw home coordinates to other members.
- Define location permission, manual-area fallback, relocation, stale location, distance rounding, and deletion behavior.
- Add pre-publication and post-publication moderation states, prohibited-item checks, copyright/takedown hooks, and operator reason codes. Block-aware filtering is integrated only after Step 7 defines block semantics.
- Connect distance, size, category, condition, mode, and availability filters to real server queries with pagination.

### Verification and exit criteria

- RLS tests prove exact coordinates and private garments are never returned through listing APIs.
- Boundary tests cover radius edges, missing permission, manual area, pagination, moderated listings, and concurrent status changes; block-specific acceptance waits for Step 7.
- Market UI displays rounded distance derived from the server, not fabricated client data.

### Rollback

Disable radius search and fall back to approved coarse regions; keep exact location collection disabled if privacy validation fails.

---

## Step 6 — Add Push Notifications and Reliable Marketplace Realtime

### Context brief

Private chat currently polls and users can miss offers or handoff actions. Notifications must be useful without leaking garment, message, location, or body-photo content onto lock screens or to the wrong account.

### Tasks

- Register, rotate, revoke, and deduplicate Expo push tokens per installation and user.
- Implement a single server-side notification outbox/send function with idempotency, retry, receipt handling, quiet preferences, and invalid-token cleanup.
- First deliver the token lifecycle, outbox, provider adapter, message/offer/handoff events, and safe deep-link authorization. Add dispute/report/block/rating events only after Step 7 defines their states.
- Add owner-filtered Realtime invalidation with polling fallback and foreground/background refresh behavior.
- Add in-app notification preferences and safe generic lock-screen copy.

### Verification and exit criteria

- Duplicate database/webhook events cannot deliver duplicate user-visible notifications.
- Sign-out, account switch, token rotation, permission denial, offline recovery, and revoked tokens behave safely.
- Development-build tests demonstrate timely state refresh and notification deep links to authorized destinations only. Expo Go is not accepted as Android remote-push evidence.

### Rollback

Disable outbound push through a server flag while keeping the outbox and in-app state updates available for later replay or diagnosis.

---

## Step 7 — Deliver Marketplace Safety, Reports, Blocks, Ratings, and Disputes

### Context brief

A peer handoff marketplace cannot launch with only chat and confirmation. It needs preventive controls, case handling, fair resolution, and operator accountability. External Gate B defines final evidence, retention, and appeal rules; implementation uses those versioned policies.

### Tasks

- Add report and block flows for members, listings, messages, offers, and transactions with safe categories and optional bounded evidence.
- Ensure blocks prevent new discovery/contact while preserving the minimum access required to safely resolve an existing transaction.
- Add post-completion bilateral ratings with anti-retaliation timing, aggregation thresholds, and moderation/appeal controls.
- Implement dispute opening, settlement freeze, evidence windows, case states, SLA timers, default outcomes, appeals, and immutable audit events.
- Build least-privilege operator screens/runbooks; require dual approval for balance-changing manual resolutions.
- Add rate limits, abuse detection, repeat-offender actions, emergency kill switches, support escalation, and reconciliation after every resolution type.
- Integrate the final block-aware discovery rules and notification events only after their state and authorization contracts are tested.

### Verification and exit criteria

- Tests prove reporters and blocked users cannot infer private case information or bypass contact restrictions.
- Every dispute outcome preserves ledger balance and releases, reverses, or retains reservations exactly once.
- A controlled operator drill completes report intake, urgent block, dispute, appeal, manual adjustment, audit review, and recovery.

### Rollback

Disable new marketplace acquisition while leaving reports, blocks, active-case resolution, transaction history, refunds/reversals, and audit export operational.

---

## Step 8 — Finish Real AI and Marketplace Try-On

### Context brief

AI adapters and privacy boundaries exist, but real-image success has not been verified with a funded Gemini project, optional cleanup is unconfigured, garment color tagging is missing, and marketplace listing detail does not complete the “See it on you” journey.

### Tasks

- Fund and smoke-test Gemini moderation, garment tagging, and image try-on with representative consented images; record latency, cost, safety, retries, and deletion behavior.
- Decide whether to configure, replace, or remove the optional cleanup provider before its announced platform transition; never expose provider secrets to Expo.
- Add structured garment color suggestions with manual override and confidence-safe fallback.
- Add marketplace try-on using the viewer’s private approved body photo and the listing’s permitted garment projection without exposing either participant’s private assets.
- Add spend caps, circuit breakers, model/version observability, provider failure recovery, stale-job handling, and regression fixtures that do not contain personal photos.

### Verification and exit criteria

- At least one approved real-image result succeeds for every AI path in staging, with cost and deletion trace recorded. Failure budgets distinguish pre-spend validation failures from provider requests that may still incur cost before failing.
- Provider outage, quota exhaustion, unsafe image, invalid output, timeout, retry, cancellation, and duplicate request produce deterministic safe states.
- A marketplace owner cannot access a viewer’s body photo or try-on result, and a viewer cannot retrieve unrelated garment media.

### Rollback

Disable the affected AI capability independently and preserve manual garment fields, original-image processing, and non-AI marketplace use.

---

## Step 9 — Build Localization/Accessibility Foundations and Run the Final Audit

### Context brief

The app has localization scaffolding and targeted layout fixes, but production requires all critical copy and interaction states to behave consistently across languages, accessibility settings, keyboards, and supported screen sizes. This milestone has two slices: Step 9A establishes shared foundations while other features are built; Step 9B performs final acceptance only after billing, seller compliance, and OAuth screens exist.

### Tasks

- Move shared and existing user-facing copy into the localization catalog and add a language selector with system-default behavior in Step 9A.
- Complete English and Brazilian Portuguese translations in Step 9B after all feature contracts stabilize, including legal, billing, seller-compliance, OAuth, safety, error, notification, and marketplace state copy.
- Audit VoiceOver/TalkBack labels, focus order, touch targets, contrast, Dynamic Type/font scaling, reduced motion, and screen-reader announcements.
- Test keyboard-safe forms, safe areas, filter rails, modals, date entry, camera permissions, loading, empty, offline, retry, expired membership, insufficient balance, and denied-permission states.
- Add visual regression coverage for core viewport/device classes and prevent scroll bounce or clipped controls where content fits.

### Verification and exit criteria

- Step 9B proves every launch-critical screen is usable in both languages with large text and a screen reader, including the screens introduced by Steps 10 and 11.
- No critical path contains untranslated strings, clipped actions, keyboard-obscured fields, fake data, or silent failure.
- Accessibility and click-path audits have no unresolved blocker/high finding.

### Rollback

Keep English as the safe fallback for missing keys while fixing catalog defects; never ship partially translated legal or billing disclosures.

---

## Step 10 — Implement Production Membership Billing and Entitlements

### Context brief

Development membership is intentionally free. This step begins only after External Gates A–C approve the product, store rail, disclosures, and lifecycle rules. The database remains authoritative; provider events are inputs, not direct balance mutations.

### Tasks

- Integrate the approved iOS/Android/web billing provider and keep digital Pro separate from marketplace membership unless the accepted ADR says otherwise.
- Verify signed provider events and implement idempotent purchase, renewal, restore, grace, lapse, cancellation, refund, revocation, chargeback, account merge, and family-sharing behavior.
- Connect signed provider events to the Step 2 party, cohort, journal, reversal, and reconciliation contracts without replacing immutable history.
- Grant first-year and renewal credits exactly once from server configuration and implement the approved refund-after-spend handling.
- Load live product price/duration data and render final renewal, terms, privacy, cancellation, and credit disclosures beside checkout.
- Add reconciliation, alerts, accounting export, support tooling, and per-surface feature flags.

### Verification and exit criteria

- Sandbox fixtures for duplicates, reordering, delayed events, restore, refund before/after spend, revocation, chargeback, and provider outage all reconcile.
- No client can grant entitlement, write balance, or forge a provider transaction.
- Store sandbox purchase/restore/cancel flows pass on supported platforms and the accepted ADR links every implemented lifecycle decision.

### Rollback

Use provider-supported actions to stop new sales and, where contractually possible, renewals while keeping webhook intake, reconciliation, restore, support, dispute/refund handling, history, and the approved wind-down path available. The exact actions and customer notice are acceptance artifacts of External Gate C.

---

## Step 11 — Complete Identity, Seller Compliance, Observability, Support, and Operations

### Context brief

Email authentication and privacy-safe first-party telemetry exist. Production still needs configured social sign-in, actionable crash diagnostics, support/recovery paths, health signals, incident ownership, and operational documentation.

### Tasks

- Configure Google and Apple OAuth, redirect allowlists, private auth sessions, account linking, collision handling, provider revocation, and reauthentication for sensitive actions.
- Re-enable production email confirmation and configure production SMTP/templates while preserving the development-only no-confirmation mode.
- Integrate an approved consent-aware crash/error service with strict field allowlists and no images, signed URLs, message text, exact location, tokens, or secrets.
- Add health/reconciliation dashboards and alerts for auth, AI jobs, notification outbox, billing events, ledger imbalance, stale reservations, disputes, and Edge Function failures.
- Configure monitored copyright/privacy/support contacts, notice-and-takedown workflow, operator permissions, incident runbooks, backup/restore verification, and data-subject request handling.
- Implement the conditional seller-compliance decision from External Gate B: required due diligence, restricted tax identity, fair-market-value snapshots for non-cash exchanges, thresholds, receipts/amendments, report delivery or remittance, retention, and tightly scoped operator access. If counsel determines a field/process is not required, preserve the written decision instead of building speculative collection.

### Verification and exit criteria

- OAuth sign-in/link/unlink/revoke and sensitive-action reauthentication pass on real devices without account duplication.
- Synthetic failures create useful redacted reports and alerts; privacy tests prove prohibited fields cannot cross the observability boundary.
- One incident, backup/recovery, support escalation, and account-data request drill is completed and documented.
- Approved seller-reporting fixtures reconcile to marketplace transactions without exposing restricted identity to ordinary app or support roles.

### Rollback

Disable individual OAuth or observability adapters while retaining email authentication and first-party safe diagnostics.

---

## Step 12 — Build the Production Release and Rollback Path

### Context brief

The app runs through Expo Go, but a production application needs repeatable native builds, environment separation, signed credentials, update policy, store metadata, and a tested rollback strategy.

### Tasks

- Configure development, preview, staging, and production EAS profiles with separate Supabase projects, bundle identifiers, secrets, deep links, and environment validation.
- Add `EXPO_TOKEN` and Android signing through protected CI environments; add Apple credentials when the Apple Developer account is available.
- Define build-number/version policy, store metadata, privacy labels/data-safety forms, permission copy, screenshots, support URLs, terms, and privacy links.
- Define safe OTA update boundaries, runtime-version and server minimum-version policy, old-client/schema compatibility windows, staged rollout, crash/health gates, rollback, database forward-fix, and feature-flag procedures.
- Produce reproducible preview and production-candidate builds and a release checklist with named owners.

### Verification and exit criteria

- Clean CI produces installable Android and iOS preview builds; production credentials are scoped and never committed or included in client bundles.
- Deep links, OAuth redirects, notifications, camera/library permissions, background/foreground transitions, updates, rollback, and environment isolation pass on device.
- Store submission artifacts and declarations match actual behavior and approved policies.

### Rollback

Halt rollout, disable risky server features, roll back an OTA update or stop binary distribution using the mechanisms actually supported by the chosen stores, enforce the tested server compatibility window, and use forward database fixes according to the runbook. Do not promise remote removal or replacement of already installed binaries.

---

## Step 13 — Prove the Whole Product and Open the Regional Pilot

### Context brief

Passing unit tests does not prove a two-sided mobile marketplace. The final step validates all journeys, recovery paths, operations, economics, and launch gates using representative devices and controlled accounts before any public expansion.

### Tasks

- Run and extend the accumulated Maestro journeys established from Step 1 onward for signup, adult eligibility, onboarding, body photo, garment capture, AI processing, closet editing, try-on, listing, discovery, offer, chat, handoff, settlement, dispute, report/block, membership lifecycle, and account deletion. Step 13 is the release run/reconciliation gate, not the first point where automation is written.
- Run credit, swap, and give-away journeys across two physical devices/accounts, including cancellation at every state, timeout, offline/retry, competing offers, insufficient balance, lapsed membership, provider outage, and moderated content.
- Run performance, accessibility, privacy, authorization, upload validation, rate-limit, dependency, migration, backup/recovery, and kill-switch tests.
- Reconcile credits, entitlements, listings, transactions, acquired garments, notifications, cases, and retained/deleted data after the staging run.
- Launch only to the approved B.C. region and cohort after density, safety, moderation staffing, support, legal, storefront, and reliability thresholds are met.
- Close only reconciled in-scope GitHub issues whose merged implementation and evidence satisfy their acceptance criteria; rewrite or defer the others. Update PRD/architecture/ADR/runbooks, tag the release, and capture post-launch metrics and stop conditions.

### Verification and exit criteria

- All Definition of Complete items pass with linked evidence; no P0/P1 defect remains open.
- Main CI, production candidate builds, database migration rehearsal, rollback drill, and two-device acceptance suite are green.
- Product, engineering, privacy/legal, safety/operations, and release owners record the pilot decision and circuit-breaker thresholds.

### Rollback

Do not expand the pilot. Stop new membership sales/acquisition, keep support and resolution paths operational, execute the tested wind-down/rollback playbook, and preserve required audit records.

## Mandatory ECC Delivery Protocol

Every implementation step follows the same ECC sequence:

1. Confirm the authoritative GitHub issue and acceptance criteria.
2. Read exact Expo SDK 57 documentation before changing Expo or React Native code.
3. Write failing tests first for the smallest vertical slice.
4. Implement server authorization and data invariants before relying on client controls.
5. Run targeted tests, then the full ECC verification loop: build/export, typecheck, lint where configured, coverage, security/PII checks, database tests, and diff review.
6. Perform security review for auth, uploads, private media, payments, credits, moderation, deletion, and operator actions.
7. Update TDD evidence, runbooks, ADRs, and GitHub issue state in the same delivery slice.
8. Merge only with green CI; record any external evidence separately from code completion.

## Standard Verification Commands

```bash
npm ci
npm run typecheck
npm run test:coverage -- --ci
npm run check:pii
npx expo-doctor
npm run build:web
npm audit --omit=dev --audit-level=critical
npm run test:db
```

Native, E2E, provider, and store-sandbox checks are added to the relevant step and cannot be replaced by Jest-only evidence.

## Evidence Used to Build This Roadmap

- [Expo SDK 57 versioned reference](https://docs.expo.dev/versions/v57.0.0/) — React Native/React/Node and supported Android/iOS toolchain baseline.
- [Expo SDK 57 notifications reference](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/) — Android remote push requires a development build rather than Expo Go.
- [Latest failed Quality checks run](https://github.com/blbacelar/smart-closet-v2/actions/runs/38487390058) — type/tests/export passed; production dependency audit and database RLS job failed.
- [`docs/ONBOARDING.md`](../docs/ONBOARDING.md) — implemented capabilities and explicit backlog.
- [`docs/MARKETPLACE.md`](../docs/MARKETPLACE.md) — current development transaction loop and production gates.
- [`docs/adr/0001-marketplace-membership-and-exchange-credits.md`](../docs/adr/0001-marketplace-membership-and-exchange-credits.md) — proposed economy, retention, dispute, and launch decisions.
- [`plans/marketplace-loops-economy.md`](marketplace-loops-economy.md) — predecessor design and compliance requirements.
- `package.json`, `.github/workflows/ci.yml`, current migrations, marketplace routes/repositories, and open GitHub issues #27 and #34–#48 inspected on 2026-10-15.

## Plan Mutation Protocol

- New scope is inserted as a numbered substep with dependencies, acceptance criteria, and rollback; it is not silently absorbed.
- A blocked external gate pauses only the dependent steps.
- A step may be marked complete only after its merged commit, green CI run, and acceptance evidence are linked.
- If implementation reveals a broken architectural assumption, update the relevant ADR and this roadmap before continuing.
- GitHub issues remain the work authority. This plan must not create a competing `.stories/` ledger.

## Immediate Execution Order

1. Start Step 1 and restore green CI.
2. Begin External Gates A–E in parallel.
3. Establish Step 2 before changing deletion, settlement, disputes, billing, or seller compliance.
4. Execute Steps 3–6 only according to the slice prerequisites; do not merge overlapping state/FK migrations concurrently.
5. Complete Steps 7–8 and Step 9A while the billing/store decisions mature.
6. Execute Step 10 only after Gates A–C; execute Step 11’s compliance slice only after Gate B.
7. Return to Step 9B for the final cross-feature language/accessibility audit.
8. Complete Step 12, then finish with Step 13 and open only the controlled regional pilot.
