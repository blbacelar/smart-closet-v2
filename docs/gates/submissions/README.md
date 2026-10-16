# Fitly external approval submission kit

**Status:** internal drafts only — not approved and not sent

**Prepared:** 2026-10-16

**Authority:** `docs/gates/gate-a-c-decision-pack.md`, ADR 0001, and GitHub #48

This directory contains exact outbound drafts that reduce the remaining Gate B
and Gate C work to human review and authorized delivery. They do not grant legal,
tax, storefront, billing, or launch approval.

## Operator approval contract

Each draft is immutable for approval purposes. The operator must approve the
exact file hash and destination before sending. Editing a file invalidates the
approval and requires a new hash and decision. A file being present, committed,
or merged is not send authorization.

| Draft ID | Counterparty | Authorized destination | File | SHA-256 | Status |
| --- | --- | --- | --- | --- | --- |
| `gate-c-apple-v1` | Apple App Review / Developer Support | Authenticated Apple/App Store Connect case chosen by the account owner | `apple-storefront-classification-request.txt` | `acbb2c9d85424c397677b191db12757adfcdb0ceb41fe5c35b50432799108325` | Drafted; not approved; not sent |
| `gate-c-google-v1` | Google Play policy support | Authenticated Play Console support case chosen by the account owner | `google-play-storefront-classification-request.txt` | `0b77b6471b62500acbe7256cd5a43b607eb65dac14c72e09f29e78ef55aca5a0` | Drafted; not approved; not sent |
| `gate-b-counsel-tax-v1` | Qualified Canadian/B.C. legal counsel and Canadian tax/accounting adviser | Recipients selected and verified by the founder | `canadian-legal-tax-review-request.md` | `9195ca5473f28e91fd205afa3c03ec353de58881732ff33860c88aa7184d5c87` | Drafted; not approved; not sent |

No destination address, account, or named professional is currently recorded.
Do not substitute a public forum, unverified email address, or social account.

## Baseline facts attached to every draft

- Production billing is disabled. Development activation is no-charge.
- Fitly proposes credits, direct one-for-one swaps, and free peer give-aways;
  cash sales and credit packs are excluded.
- The working recommendation is CAD 59/year, 60 first-year credits, and 30
  renewal credits, but none of those values is approved.
- The digital AI `pro` entitlement remains separate from the proposed
  `marketplace_member` entitlement.
- The exact proposed lifecycle and stop conditions are in
  [`../gate-a-c-decision-pack.md`](../gate-a-c-decision-pack.md).
- No Apple Developer, App Store Connect, or Google Play Console decision/case is
  recorded in the repository.

## Required approval receipt

Before sending a draft, record all of the following in GitHub #48 or an approved
private evidence register. Never commit secrets, tax identifiers, private legal
advice, or account credentials.

| Field | Required value |
| --- | --- |
| Draft ID and SHA-256 | Exact row from the manifest above |
| Operator | Named human with authority to send for Fitly |
| Decision | Approved or rejected |
| Decision time | ISO-8601 timestamp |
| Destination | Verified account/case/channel, redacted if sensitive |
| Changes requested | None, or create a new version and hash |

After authorized delivery, record the provider/counsel receipt or case number,
delivery time, and the exact sent hash. If delivery status is uncertain, mark it
unknown and reconcile with the destination; do not automatically resend.

## Response intake

Responses are evidence, not self-executing decisions:

1. Preserve the original response privately with its case/thread identifier.
2. Add a non-sensitive summary and evidence reference to GitHub #48.
3. Have the named Gate A/B/C approvers resolve conflicts and fill the selected
   storefront matrix in the canonical decision pack.
4. Reconcile issue #27/C19 if the selected rail unbundles grants, or leave
   C19/C20 blocked if the pilot remains no-charge.
5. Never enable a production checkout flag from an informal or ambiguous reply.

## Hash refresh procedure

Run the following after any draft edit, then update this manifest in the same
commit:

```sh
shasum -a 256 docs/gates/submissions/apple-storefront-classification-request.txt
shasum -a 256 docs/gates/submissions/google-play-storefront-classification-request.txt
shasum -a 256 docs/gates/submissions/canadian-legal-tax-review-request.md
```

An approval for an older hash is stale and must not authorize the changed text.
