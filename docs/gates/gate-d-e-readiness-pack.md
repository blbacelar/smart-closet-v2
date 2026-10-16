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
| Receipt stage | Exact `access-ready` or `acceptance-ready` stage |
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

An `access-ready` receipt authorizes only the corresponding story start; it does
not close the capability or Gate D. An `acceptance-ready` receipt closes the
capability only when every required field is present, the capability and
disable/rollback verifications both passed, open findings are `none`, the
authorized approver explicitly decided `approved`, and the evidence can still
be accessed by the named reviewer. A failed, rejected, conditional, expired,
inaccessible, or partially completed receipt leaves that stage open. Editing
the underlying provider configuration invalidates both stages affected by the
change.

## Gate D — accounts and credentials

Gate D has two phases. **Access-ready** proves that engineering can safely begin
the story. **Acceptance-ready** is story exit evidence and closes the capability.
Gate D closes only when every mandatory acceptance-ready row and every row
required by the selected Gate C topology is approved. A conditional billing row
is not applicable only when the signed Gate C matrix explicitly excludes it.

### Access-ready — story start authorization

Minimum connectivity means a provider-supported, non-destructive check with a
controlled test identity or fixture. It must not claim the end-to-end behavior
owned by the story.

| Capability | Access-ready evidence | Authorizes start of |
| --- | --- | --- |
| Apple Developer and App Store Connect | Organization/team owner, accepted current terms, least-privilege operator role, registered `app.fitly.mobile` identifier, signing credentials outside Git, and successful authenticated console/API access | C20 iOS adapter after C19/Gate C; C22 Apple OAuth; C24 iOS release work |
| Google Play Console | Account owner, accepted current terms, least-privilege operator role, registered `app.fitly.mobile` package, signing credentials outside Git, internal-test entitlement, and successful authenticated console/API access | C20 Android adapter after C19/Gate C; C22 Google OAuth; C24 Android release work |
| Hosted Supabase staging | Organization/project owner, isolated non-production project, least-privilege roles, environment-bound secrets outside Git, approved seed boundary, and authenticated health/connectivity check | C17 provider staging; C20/C22 sandbox integration; C24 environment work |
| Hosted Supabase production | Separate production project/account owner, accepted terms, least-privilege deployment and recovery roles, production-bound secrets outside Git, backup entitlement, and authenticated health/connectivity check without member data | C24 production deployment work |
| EAS project, APNs/FCM v1, and Expo push | Confirmed EAS project `ac7a88d2-7cf9-49da-8e55-e03dc63e7618` owner, scoped automation role, APNs/FCM owners, credentials outside Git, rotation/revocation owners, and authenticated non-delivery connectivity checks | C10 physical acceptance follow-up; C11; C24 build/push work |
| Funded direct Gemini staging project | Billing/funding owner, accepted provider terms, budget/alert boundary, approved data-processing configuration, secret stored in the Edge Function environment, non-personal fixture policy, and minimal authenticated model connectivity check | C17 |
| Optional image cleanup provider | Written `required`, `deferred`, or `excluded` decision; if required, provider owner, privacy approval, funding/budget, credentials outside Git, deletion contract, and minimal connectivity check | C17 when required |
| Production SMTP | Provider owner, verified sending-domain control, accepted terms, least-privilege credential outside Git, and authenticated sandbox/test connection to a controlled non-personal inbox | C24 email implementation |
| Approved crash/error provider | Product/privacy-approved provider, account/project owner, accepted terms, least-privilege project, environment-bound credential outside Git, retention ceiling, and authenticated project connectivity | C24 crash-provider implementation |
| Apple and Google OAuth | Provider app/client owners, accepted terms, registered client identifiers and exact redirect URIs, secrets outside Git, consent-screen plan, and provider configuration access | C22 |
| Web billing provider (conditional) | When selected by Gate C: provider/account owner, accepted terms, sandbox/production separation, sandbox product/price IDs, tax configuration owner, scoped API and webhook secrets outside Git, and authenticated sandbox connectivity | C19 provider event work; C20 selected web rail; C24 release work |
| StoreKit billing (conditional) | When selected by Gate C: App Store Connect owner, accepted agreements, sandbox SKU/product identifiers, tax/banking owner where applicable, server-notification configuration access, secrets outside Git, and authenticated sandbox access | C20 selected iOS rail; C24 iOS release work |
| Google Play Billing (conditional) | When selected by Gate C: Play owner, accepted agreements, sandbox SKU/product identifiers, merchant/tax owner where applicable, Real-time Developer Notifications configuration access, secrets outside Git, and authenticated sandbox access | C20 selected Android rail; C24 Android release work |

### Acceptance-ready — story exit and Gate D closure

| Capability | Acceptance-ready evidence produced by the story | Required disable/rollback proof |
| --- | --- | --- |
| Apple Developer and App Store Connect | Reproducible signed internal iOS build installed and exercised on a physical device, with role/signing review | Revoke operator/signing access and halt new distribution without deleting audit evidence |
| Google Play Console | Reproducible signed internal Android build installed from the internal track and exercised on a physical device | Remove operator/tester/release access and halt the track without deleting evidence |
| Hosted Supabase staging | Applied migrations/functions, auth/storage configuration, seed isolation, story smoke tests, backup export/isolated restore, and forward-fix exercise | Revoke staging access/secrets, stop affected functions, restore only to isolation, and forward-fix without weakening RLS |
| Hosted Supabase production | Approved auth/storage/network/retention configuration, migration/function deployment, backup schedule, isolated restore drill, old-client/schema compatibility window, and forward-fix drill | Revoke scoped access, disable affected features, preserve compatible clients, restore to isolation, and apply a reviewed forward fix |
| EAS project, APNs/FCM v1, and Expo push | Reproducible physical builds; credential rotation/revocation exercise; push registration and Expo ticket/receipt reconciliation; observed safe delivery/deep links on physical iOS/Android in foreground, background, and terminated states | Revoke/rotate credentials; set `EXPO_PUSH_ENABLED=false`; republish only a runtime-compatible OTA; halt binary rollout and ship a replacement while preserving server compatibility. Installed binaries cannot be remotely replaced |
| Funded direct Gemini staging project | Successful moderation, tagging, color, and try-on flows using representative non-personal images; recorded latency/cost/privacy behavior; provider failure and budget circuit breakers | Disable the provider secret/enqueue path without bulk retry or media exposure |
| Optional image cleanup provider | If required, representative cleanup, deletion, original-image preservation, cost, timeout, and provider-failure evidence; otherwise the approved exclusion/defer receipt | Remove the provider secret and preserve the original private garment image/state |
| Production SMTP | SPF/DKIM/DMARC result, reviewed templates, production confirmation enabled, delivery/bounce evidence, account recovery, and provider failure behavior | Disable/rotate the provider credential, revert configuration/templates, and preserve account access/support |
| Approved crash/error provider | C23 allowlist deployed, synthetic redacted event and alert, retention behavior, deletion/export test, and provider outage behavior | Disable the adapter and credential without preventing app startup or first-party diagnostics |
| Apple and Google OAuth | Physical-device sign-in, link, redirect, revoke, collision, fallback email login, and strong reauthentication evidence | Revoke provider credentials while preserving email login and safe reauthentication |
| Web billing provider (conditional) | Signed webhook verification, provider-event ownership/idempotency, sandbox purchase/renew/cancel/refund/revoke, duplicate-purchase behavior, server-session mobile restore, disclosures, and reconciliation | Rotate/revoke webhook secrets; stop sales/renewals while retaining webhook intake, reconciliation, refunds, history, open transactions, and approved wind-down |
| StoreKit billing (conditional) | Server-notification verification, provider-event ownership/idempotency, and sandbox purchase/restore/renew/cancel/refund/revoke with disclosures and reconciliation | Stop App Store sales/renewals while retaining notifications, reconciliation, refunds, restore/history, and approved wind-down |
| Google Play Billing (conditional) | Real-time Developer Notification verification, provider-event ownership/idempotency, and sandbox purchase/restore/renew/cancel/refund/revoke with disclosures and reconciliation | Stop Play sales/renewals while retaining notifications, reconciliation, refunds, restore/history, and approved wind-down |

### Gate D sequencing

1. The owner verifies the provider account, current terms, funding where
   required, operator role, environment, secret placement, and minimum
   connectivity outside this repository.
2. An independent reviewer and authorized approver issue an `access-ready`
   receipt. Only then may the dependent story begin. Store/web billing also
   requires the signed Gate A-C contract and its selected provider rows.
3. The story implements its flow and produces the acceptance evidence above,
   including failure, disable/rollback, reconciliation, and device/provider
   tests. These outcomes are never prerequisites for starting that same story.
4. The independent reviewer and authorized approver issue a separate
   `acceptance-ready` receipt only after every story exit check passes with no
   open findings. That receipt closes the capability.
5. Production remains separate from sandbox/staging and requires C24's own
   acceptance-ready release and rollback evidence.

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
| C11 marketplace notifications | C07, C10, and C15; EAS/APNs/FCM `access-ready` approval is required before physical delivery/deep-link acceptance begins |
| C13-C15 moderation/block/dispute | Gate B takedown, report, evidence, appeal, retention, and resolution policies approved |
| C16 ratings/operator tools | C15 plus Gate E moderator/support owner and dual-approval operators |
| C17 real-provider AI | Gemini `access-ready` approved; optional cleanup `access-ready` decision recorded |
| C18A/B final language/accessibility | Its upstream user-visible stories are implemented and final copy exists |
| C19 entitlement lifecycle | Signed Gates A-C contract and issue #27 contract reconciled |
| C20 store billing | C19, the signed Gate C rail, and every corresponding web/StoreKit/Play `access-ready` row approved |
| C21 seller compliance | Gate B reporting/due-diligence decision approved |
| C22 social OAuth | Corresponding OAuth provider `access-ready` row approved |
| C24 production release | C18B and C19-C23 complete plus all applicable production Gate D `access-ready` rows approved; C24 produces their acceptance-ready evidence |
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
