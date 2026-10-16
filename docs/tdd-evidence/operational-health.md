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

Independent review then found four gaps and returned `CHANGES_REQUESTED`: the
monitor would have received a Supabase service key, string telemetry values and
direct table inserts could bypass privacy intent, unclaimed notification work
was invisible, and cron used different thresholds from the endpoint. New RED
tests reproduced each issue before the fixes.

The re-review then exposed PostgreSQL three-valued logic in the analytics RPC:
`NOT NULL` did not enter a PL/pgSQL `IF`, so a modified client could omit a
required property. Five new pgTAP assertions reproduced the bypass. The RPC now
accepts only an explicit `TRUE` validation result and rejects both `FALSE` and
`NULL`.

## GREEN

- Focused Jest: handler, migration, and observability privacy contracts pass.
- TypeScript: `tsc --noEmit` passes.
- Isolated database: schema lint, legacy forward migration, RLS 83/83, all
  marketplace concurrency/deletion suites, and operational health 31/31 pass.
- The operational drill produces one aggregate warning snapshot, exposes no IDs,
  and deletes snapshots older than 30 days.
- The monitor uses an independent high-entropy token; the Supabase service secret
  never leaves the function. Analytics ingestion is an exact server-validated
  RPC, with direct authenticated table inserts revoked.
- Dispatcher and receipt-worker stoppages are detected, and endpoint/cron
  thresholds share one private authoritative configuration.
- Complete `npm run quality`: 98 suites and 580 tests pass with 90.78%
  statements, 81.12% branches, 85.32% functions, and 92.79% lines. PII scan,
  Expo Doctor 21/21, web export, critical production audit, and the repeated
  isolated database harness pass.

The final complete quality and CI results are recorded on PR #84.
