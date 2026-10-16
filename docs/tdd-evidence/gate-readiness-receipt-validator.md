# TDD evidence: Gate D/E readiness receipt validator

## User journey

An authorized operator keeps a Gate D/E receipt JSON outside the repository,
runs one local command, and gets a deterministic pass/fail result without the
tool printing secrets, personal data, or receipt contents. An independent
reviewer still verifies the referenced provider/private-register evidence.

## RED

- Commit: `1f347db` (`test: add red gate receipt validator coverage`)
- Command: `npx jest scripts/__tests__/checkGateReadinessReceipt.test.js --runInBand`
- Expected failure: Jest could not resolve
  `scripts/check-gate-readiness-receipt.js` because the validator did not yet
  exist.

## GREEN

- Commit: `e135e3f` (`feat: validate Gate D and E receipts fail closed`)
- Same command result: 17 of 17 tests passed after the initial implementation.
- Hardening run: 37 of 37 tests passed after adding capability manifests,
  exact check IDs, environment/build/reconciliation rules, chronology, exact
  ISO-8601/calendar, field types, nested schemas, private-file/symlink
  boundaries, CLI exit codes, and adversarial no-secret/no-key-echo coverage.
- Coverage command:
  `npx jest scripts/__tests__/checkGateReadinessReceipt.test.js --runInBand --coverage --collectCoverageFrom=scripts/check-gate-readiness-receipt.js`
- Coverage: 87.74% statements, 85.91% branches, 94.28% functions, and 89.12%
  lines.

## Guarantees exercised

- Complete current `access-ready`, `acceptance-ready`, and optional cleanup
  `decision-only` receipts pass.
- Missing ownership, approval, access reference, checks, reconciliation, or
  reconsideration fails closed.
- Deferred cleanup decisions require a dated reconsideration trigger; only an
  excluded decision may be permanent for the release.
- Capability/stage/environment mismatches, missing native builds, and missing,
  duplicate, or unknown capability check IDs fail closed.
- Failed, rejected, expired, future, malformed, and non-ISO evidence fails.
- Unknown top-level and nested fields fail instead of silently extending the
  contract.
- Wrong field types, blank required text, impossible calendar dates, and
  locale-dependent dates fail closed.
- Secret-like values and direct personal/contact data are rejected without
  their paths, filenames, untrusted JSON keys, or values appearing in findings
  or CLI output.
- Files and symlink targets inside the repository are refused so private
  receipts cannot be normalized into source control by the validator workflow.
- The CLI returns `0` for valid receipts, `1` for findings, and `2` for missing
  arguments; malformed JSON is rejected.

## Deliberate boundary

The validator proves only that a private receipt conforms to this repository's
evidence contract and declares passing outcomes. It cannot authenticate the
provider, approver, reviewer, evidence reference, or underlying test result.
Those facts remain external evidence that the independent reviewer must inspect
before Gate D or Gate E can close.
