# Gate D-E readiness pack: provider access and pilot operations

**Status:** evidence contract prepared; Gates D and E are open

**Prepared:** 2026-10-16

**Authority:** `plans/app-completion-roadmap.md`, GitHub #48, and the linked
story issues below

This pack defines the minimum evidence required before engineering may claim
that provider access or pilot operations are ready. It does not authorize a
purchase, production deployment, provider configuration, pilot invitation, or
launch. Account creation, provider terms, named people, monitored addresses,
and all secrets remain human-owned external actions.

## Non-negotiable evidence boundary

- Never commit API keys, OAuth secrets, signing certificates, SMTP passwords,
  access tokens, private legal advice, personal email addresses, or member
  details.
- Store credentials only in the provider's secret manager, EAS environment, or
  Supabase Edge Function secret store, scoped to the smallest required role and
  environment.
- The repository may contain only a non-sensitive evidence reference, such as
  a redacted case/build identifier, provider console path, private register
  record ID, timestamp, reviewer, and pass/fail result.
- Presence of an environment variable or project identifier proves neither
  account ownership nor funding, permissions, correct configuration, or a
  successful real-provider test.
- A screenshot, console entry, or successful build is evidence only for the
  exact environment, capability, app version, and time recorded with it.
- Unknown, expired, revoked, or unreviewed evidence is `not ready`. Never
  substitute a development key or personal account for production evidence.

## Evidence receipt

Record one receipt per capability in GitHub #48 or an approved private evidence
register. Do not paste credentials or personal data into an issue.

| Field | Required value |
| --- | --- |
| Gate and capability | Exact row name from this pack |
| Environment | Staging, sandbox, or production |
| Account owner | Named accountable human; keep contact details private |
| Authorized approver | Named human authorized to accept this capability for Fitly |
| Least-privilege operator | Human/role permitted to configure and rotate access |
| Evidence reference | Non-sensitive build, case, console, or private-register ID |
| Capability verification | Exact test performed and explicit `passed` or `failed` result |
| Disable/rollback verification | Exact exercise performed and explicit `passed` or `failed` result |
| App/build version | Immutable commit and native build identifier |
| Verified at | ISO-8601 timestamp |
| Reviewer | Independent human who checked the evidence |
| Open findings | `none`, or the capability remains open |
| Decision | Explicit `approved` or `rejected` by the authorized approver |
| Decision time | ISO-8601 timestamp |
| Disable/rollback action | Provider-supported action and responsible owner |
| Expiry/rotation | Expiry date or next access review |

A receipt closes a capability only when every required field is present, the
capability and disable/rollback verifications both passed, open findings are
`none`, the authorized approver explicitly decided `approved`, and the evidence
can still be accessed by the named reviewer. A failed, rejected, conditional,
expired, inaccessible, or partially completed receipt leaves the capability
open. Editing the underlying provider configuration invalidates the receipt for
capabilities affected by the change.

## Gate D — accounts and credentials

Gate D closes only when every mandatory capability below and every capability
required by the selected Gate C topology are verified. A story may use the
smallest independently verified subset shown in the **Unblocks** column; Gate D
as a whole remains open until the applicable rows are complete. A conditional
billing row is not applicable only when the signed Gate C matrix explicitly
excludes that rail.

| Capability | Required evidence | Required disable/rollback proof | Unblocks |
| --- | --- | --- | --- |
| Apple Developer and App Store Connect | Organization/team owner, least-privilege roles, registered `app.fitly.mobile` identifier, signing assets held outside Git, and a signed internal iOS build installed on a physical device | Revoke operator/signing access and stop distribution without deleting audit history | C20 sandbox iOS after Gate C; C22 Apple OAuth; C24 iOS release |
| Google Play Console | Account owner, least-privilege roles, registered `app.fitly.mobile` package, internal test track, and an installed signed Android build | Remove tester/release access and halt the track without destroying evidence | C20 sandbox Android after Gate C; C22 Google OAuth; C24 Android release |
| Hosted Supabase staging | Organization/project owner, an isolated non-production project, least-privilege roles, environment-bound client and Edge Function secrets, applied migrations/functions, auth/storage configuration, seed isolation, migration smoke, backup export/restore exercise, and forward-fix exercise | Revoke staging access/secrets, stop affected functions, restore only into an isolated project, and apply a tested forward migration without weakening RLS | C17 real-provider staging; C20/C22 sandbox integration; C24 environment isolation |
| Hosted Supabase production | Separate production project and owner, least-privilege roles, production-bound secrets, auth/storage/network/retention configuration, migration and function deployment evidence, backup schedule, isolated restore drill, old-client/schema compatibility window, and forward-fix runbook | Revoke scoped access, disable affected server features, keep compatible clients operational, restore to an isolated recovery project, and use a reviewed forward database fix | C24 production candidate; C25 recovery acceptance |
| EAS project, APNs/FCM v1, and Expo push | Confirmed ownership of EAS project `ac7a88d2-7cf9-49da-8e55-e03dc63e7618`, scoped automation token, physical-device builds, APNs and FCM v1 credential ownership/rotation/revocation, push registration, Expo ticket/receipt reconciliation, and observed delivery plus safe deep-link behavior on physical iOS and Android devices in foreground, background, and terminated states | Revoke/rotate EAS, APNs, and FCM credentials; set `EXPO_PUSH_ENABLED=false`; republish a known-good OTA only within its compatible runtime; halt binary distribution and ship a replacement build while preserving server compatibility and feature-disable controls. Already installed binaries cannot be remotely replaced | C10 physical delivery acceptance; C11; C24 |
| Funded direct Gemini staging project | Billing/funding owner, budget/alert boundary, approved data-processing configuration, deployed Edge Function secret, representative non-personal image set, cost record, and successful moderation/tagging/try-on smoke | Disable the provider secret/enqueue path without bulk retrying or exposing stored media | C17 |
| Optional image cleanup provider decision | Written `required`, `deferred`, or `excluded` decision; if required, include privacy review, funded credentials, budget, and deletion behavior | Remove provider secret and preserve the original private garment image/state | C17 |
| Production SMTP and authentication email | Provider owner, verified sending domain, SPF/DKIM/DMARC result, production templates, email confirmation enabled, delivery/bounce test, and account-recovery test | Disable the provider credential, revert the template/configuration, and preserve account access/support | C24 |
| Approved crash/error provider | Product/privacy approval, least-privilege project, environment-specific credential, C23 allowlist configuration, retention setting, synthetic redacted event, alert routing, and deletion/export test | Disable the client/server adapter and credential without preventing the app from starting | C24 |
| Apple and Google OAuth | Provider app/client ownership, exact redirect URIs, secrets outside Git, consent-screen status, and real-device sign-in/link/revoke/collision evidence | Revoke provider credentials while preserving email login and safe reauthentication | C22 |
| Web billing provider (conditional) | Required when the signed Gate C matrix includes paid web membership: selected provider/account owner, sandbox and production separation, immutable product/price IDs, tax configuration, secrets and webhook-signing keys outside Git, provider-event ownership/idempotency fixtures, sandbox purchase/renew/cancel/refund/revoke, duplicate-purchase behavior, mobile server-session restore, and approved disclosures | Rotate/revoke webhook secrets; stop new sales and renewals using provider-supported controls; keep webhook intake, reconciliation, refunds, member history, open transactions, and the approved wind-down path operational | C19 provider event integration; C20 selected web rail; C24 production release |
| StoreKit billing (conditional) | Required only when the signed Gate C matrix selects an iOS paid store rail: App Store Connect sandbox product/SKU ownership, agreements/tax/banking readiness where applicable, server notification signing/verification, provider-event ownership/idempotency, and sandbox purchase/restore/renew/cancel/refund/revoke evidence | Stop new sales/renewals using supported App Store controls while retaining notifications, reconciliation, refunds, restore/history, and the approved wind-down behavior | C20 selected iOS rail; C24 iOS release |
| Google Play Billing (conditional) | Required only when the signed Gate C matrix selects an Android paid store rail: Play sandbox product/SKU ownership, merchant/tax configuration where applicable, Real-time Developer Notifications verification, provider-event ownership/idempotency, and sandbox purchase/restore/renew/cancel/refund/revoke evidence | Stop new sales/renewals using supported Play controls while retaining notifications, reconciliation, refunds, restore/history, and the approved wind-down behavior | C20 selected Android rail; C24 Android release |

### Gate D sequencing

1. The account owner creates or verifies the provider account and accepts its
   current terms outside this repository.
2. A least-privilege operator configures the staging/sandbox capability and
   stores secrets in the approved secret manager.
3. Engineering runs only the story-specific test authorized by the verified
   capability. Store or web billing still requires the signed Gate A-C contract
   and the provider row selected by that contract.
4. An independent reviewer checks redaction, result, rollback/disable behavior,
   and version binding before the story marks the capability ready.
5. Production access remains separate from sandbox/staging and requires C24's
   release and rollback acceptance.

## Gate E — pilot operations

Gate E is an operating commitment, not a configuration file. It closes only
when the following decisions are owned, numeric where required, monitored, and
tested through an operator drill.

| Decision | Required evidence | Required for production/pilot acceptance of |
| --- | --- | --- |
| Pilot owner and region | Named accountable founder/product owner; exact Canadian region boundary and timezone; start/end or review window | C26A and C26 |
| Moderator and support coverage | Named primary and backup owners, private monitored contacts, coverage hours, escalation path, and access review | C16 and C26 |
| Pilot cohort | Invite authority, maximum member count, eligibility, consent/waitlist terms, removal process, and non-personal test accounts | C26A and C26 |
| Service levels | Numeric response/resolution targets for safety reports, moderation, disputes, account deletion, privacy requests, and support | C13-C16 and C21 pilot acceptance; C26 |
| Reliability thresholds | Numeric measurement windows and pass/stop levels for crash-free sessions, API/Edge Function success, stale reservations, ledger imbalance, notification latency, AI success/latency/cost, and recovery time | C24-C26 |
| Marketplace safety/economy thresholds | Numeric fraud/loss, report, dispute, reversal, and moderation limits aligned with approved Gates A/B | C16, C25, C26 |
| Inventory activation thresholds | Definition of an active closet plus minimum listings by region, category, and size; waitlist conversion target and support-capacity ceiling | C26A and C26 |
| Circuit-breaker ownership | Named owner and backup for membership, new accounts, listings, offers, settlements, AI, push, and regional activation switches | C16; C23 production operationalization; C24-C26 |
| Incident and rollback drill | Timestamped exercise using aggregate/redacted evidence, expected alerts, owner acknowledgement, kill-switch action, reconciliation, and recovery | C16, C24-C26 |

Existing values in `docs/OPERATIONS.md` are development/pilot defaults. They do
not satisfy Gate E until the named owners explicitly accept or replace every
numeric value and measurement window.

Gate E service levels and operational thresholds do not block implementation of
C13-C15 or C21 after Gate B approves their policy contracts; they block those
features from production/pilot acceptance. C23 is already implemented, and Gate
E closes its production operationalization rather than reopening that merged
engineering slice. C16 still requires named operators at implementation start
because least-privilege access and dual approval cannot be tested without them.

## Story start matrix

| Story | May start only after |
| --- | --- |
| C06 retention expiry | Gate B retention, hold-release, restore/re-delete, and evidence policy approved |
| C13-C15 moderation/block/dispute | Gate B takedown, report, evidence, appeal, retention, and resolution policies approved |
| C16 ratings/operator tools | C15 plus Gate E moderator/support owner and dual-approval operators |
| C17 real-provider AI | Funded Gemini row verified; optional cleanup decision recorded |
| C18A/B final language/accessibility | Its upstream user-visible stories are implemented and final copy exists |
| C19 entitlement lifecycle | Signed Gates A-C contract and issue #27 contract reconciled |
| C20 store billing | C19, the signed Gate C rail, and every corresponding web/StoreKit/Play sandbox row verified |
| C21 seller compliance | Gate B reporting/due-diligence decision approved |
| C22 social OAuth | Corresponding OAuth provider row verified |
| C24 production release | C18B and C19-C23 complete plus all production Gate D rows and rollback owners verified |
| C25 release acceptance | C05-C17 and C18B-C24 complete with two-device/provider evidence |
| C26A waitlist/metrics | Gate E pilot owner, region, cohort, density, and support thresholds approved |
| C26 regional pilot | C25, C26A, and signed Gates A-E evidence complete |

## Stop conditions

Keep the affected feature disabled and the story blocked if any of the following
is true:

- ownership, destination, provider terms, funding, or least-privilege access is
  unknown;
- a secret appears in source control, logs, screenshots, tickets, or chat;
- evidence is not tied to an immutable build/commit and environment;
- the real-provider test used personal or production member media;
- rollback, credential revocation, kill switch, or reconciliation fails;
- web/StoreKit/Play billing behavior conflicts with the selected Gate C matrix;
- the named operator cannot acknowledge or act within the approved SLA;
- a threshold lacks a unit, measurement window, data source, owner, or explicit
  pass/stop comparison.

## Current truthful status

- The repository contains an EAS project identifier and production-shaped
  configuration, but ownership, scoped credentials, signed physical builds,
  store projects, and production release evidence are not recorded.
- No isolated hosted Supabase staging/production ownership, deployment,
  backup/restore, compatibility, or forward-fix receipt is recorded.
- The Gate C topology and web/StoreKit/Play provider are not selected, so no
  billing capability row is applicable or complete yet.
- APNs/FCM ownership and rotation plus observed physical-device push/deep-link
  delivery are not recorded; an Expo ticket or receipt alone is insufficient.
- Local development contains provider configuration, but credential presence,
  funding, current provider acceptance, and privacy approval are not proven by
  the repository.
- Development email confirmation is intentionally disabled; production SMTP,
  templates, confirmation, delivery, and recovery evidence are not recorded.
- OAuth providers are disabled in the committed Supabase configuration.
- C23 health checks and development kill switches exist, but the production
  crash provider, monitored contacts, numeric Gate E thresholds, and named
  operator coverage are not recorded.
- Therefore Gates D and E remain open and every dependent issue remains blocked.

## Canonical issue mapping

- Gate D Gemini / C17: GitHub #39
- Gate D store billing / C20: GitHub #90
- Gate D OAuth / C22: GitHub #92
- Gate D production release / C24: GitHub #89
- Gate E operator tools / C16: GitHub #87
- Gate E waitlist and metrics / C26A: GitHub #38
- Final decision authority / C26: GitHub #48

When evidence changes, update the relevant issue first, then update this pack
and the roadmap in the same reviewed pull request. Never close an issue based
only on account existence or an unchecked checklist.
