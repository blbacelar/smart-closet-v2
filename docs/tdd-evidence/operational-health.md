# C23 privacy-safe operational health — TDD evidence

GitHub authority: #84.

## Contract

- Analytics and crash reporting remain consent-gated and discard messages,
  stacks, paths, URLs, emails, tokens, media, coordinates, and identifiers.
- The service-only health endpoint emits allowlisted aggregate metrics and fails
  closed on malformed database output.
- Integrity anomalies are immediately critical; worker thresholds are bounded
  deployment configuration.
- Private aggregate snapshots run every five minutes and expire after 30 days.
- A synthetic incident can prove warning/critical behavior without identifying a
  member or resource.

## RED

Commit `9ee5d98` introduced the privacy, handler, and migration contracts before
implementation. The focused suite failed for the missing health handler and SQL
migration, and because observability still admitted sensitive values under
otherwise safe-looking property keys.

During GREEN verification, the real database linter found an ambiguous PL/pgSQL
`status` reference that source tests could not detect. After table qualification,
the executable pgTAP drill reached 20/23 assertions and identified an unavailable
pgTAP helper; the equivalent privacy assertion was expressed in native SQL.

## GREEN

- Focused Jest: handler, migration, and observability privacy contracts pass.
- TypeScript: `tsc --noEmit` passes.
- Isolated database: schema lint, legacy forward migration, RLS, all marketplace
  concurrency/deletion suites, and operational health 23/23 pass.
- The operational drill produces one aggregate warning snapshot, exposes no IDs,
  and deletes snapshots older than 30 days.
- Complete `npm run quality`: 97 suites and 576 tests pass with 90.77%
  statements, 81.04% branches, 85.29% functions, and 92.77% lines. PII scan,
  Expo Doctor 21/21, web export, critical production audit, and the repeated
  isolated database harness pass.

The final complete quality and CI results are recorded on PR #84.
