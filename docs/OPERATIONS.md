# Fitly operations and incident runbook

This runbook covers the provider-neutral C23 operational-health foundation.
Production notification, crash-monitoring, and on-call providers remain external
deployment choices; the application does not send member content to a monitoring
vendor by default.

## Privacy boundary

- Client analytics and crash reporting require explicit analytics consent.
- Error reports contain only an allowlisted error class, operation, stable error
  code, and fatal flag. Messages, stacks, paths, URLs, emails, tokens, image data,
  coordinates, and member/resource identifiers are discarded.
- Event properties use an explicit key allowlist. String values must be short
  slug-like values; unknown keys and unsafe values are discarded.
- Operational health returns seven aggregate counters only. The endpoint rejects
  unexpected database fields and never returns database errors.
- Scheduled snapshots are in the `private` schema, retain aggregate JSON for 30
  days, and are unavailable to `anon`, `authenticated`, and the health endpoint.

## Health endpoint

Deploy `operations-health` as a server-only protected Supabase Edge Function. The
Supabase service secret stays inside the function and is used only for its
aggregate database RPCs. The monitor receives a separate high-entropy
`OPERATIONS_HEALTH_ACCESS_TOKEN` Bearer credential with no database privileges.
Do not put either credential in the mobile app, a browser, logs, screenshots, or
tickets.

`supabase/config.toml` sets `verify_jwt = false` only for this function so the
gateway accepts the independent token. The handler still rejects every request
whose exact Bearer token does not match; never disable that handler check.

Responses use `Cache-Control: no-store`:

- `200` with `status: ok` or `status: warning`
- `503` with `status: critical`
- `401` for a missing or incorrect service credential
- `500` with only `health_check_failed` when the database output or call is invalid

The checked metrics are:

| Metric | Meaning |
| --- | --- |
| `credit_ledger_imbalance` | Double-entry reconciliation has an imbalance |
| `acquisition_anomalies` | A completed exchange has a closet-copy anomaly |
| `overdue_marketplace_items` | Offers or handoffs are beyond their deadline |
| `expiry_retry_backlog` | Deadline work is waiting for retry |
| `stale_tryon_jobs` | AI jobs remained queued/running too long |
| `stale_notification_work` | Push work has a stale lease or exhausted attempts |
| `recent_notification_failures` | Push work became terminal in the last hour |

Ledger and acquisition integrity metrics are critical at the first anomaly. The
other metrics use deployment-owned thresholds:

```dotenv
OPERATIONS_HEALTH_STALE_MINUTES=15
OPERATIONS_HEALTH_WARNING_COUNT=1
OPERATIONS_HEALTH_CRITICAL_COUNT=10
```

Generate `OPERATIONS_HEALTH_ACCESS_TOKEN` in the deployment secrets manager as
an independent random value of at least 32 characters; never commit its value.

The stale interval must be 1–1440 minutes, the warning count must be positive,
and the critical count must exceed the warning count. Invalid configuration
fails function startup instead of silently weakening alerts. On each monitor
check, the Edge Function synchronizes these bounds to a private database row;
both the endpoint and scheduled snapshots then read that single authoritative
configuration.

## Monitor integration

Configure the chosen uptime/on-call service to issue a server-side `GET` every
five minutes. Alert immediately on `503`, on repeated `500`, or on missing polls.
Treat `warning` as a ticket unless it persists for two polls; production owners
must replace these pilot defaults with the numeric thresholds approved in Gate E.
The monitor may retain the aggregate response but must never attach service
credentials or raw application/database logs to the alert.

## Incident response

1. Record the response timestamp, metric name, aggregate count, deployment, and
   current app/function versions. Do not query member rows until an authorized
   incident owner establishes that it is necessary.
2. For ledger imbalance or acquisition anomalies, disable new marketplace
   transactions using `marketplace_config.transactions_enabled = false`.
3. For expiry backlog, keep new transactions disabled if deadlines could strand
   credits or garments; inspect the private retry queue through an authorized
   database operator.
4. For AI backlog, disable the provider-facing enqueue path or its deployment
   secret before retrying work. Never bulk-retry without checking idempotency and
   spend boundaries.
5. For notification backlog, set `EXPO_PUSH_ENABLED=false`. This defers work
   without consuming retry attempts.
6. Reproduce with the isolated test below, repair with a forward migration or
   function rollback, run the complete quality gate, and record reconciliation
   after recovery.
7. Re-enable a kill switch only after two consecutive healthy checks and the
   relevant reconciliation query returns zero anomalies.

## Synthetic incident and recovery drill

The executable drill creates a due expiry-retry row, confirms a warning without
revealing its UUID, captures the aggregate snapshot, verifies retention, and
rolls back:

```sh
npm run test:db:upgrade
```

The focused handler drill proves `503` behavior and malformed-output fail-closed
handling:

```sh
npm test -- --runInBand supabase/functions/operations-health/__tests__/handler.test.ts
```

Run both after threshold, reconciliation, worker, notification, or marketplace
state changes.

## Rollback

- Edge Function: redeploy the last known-good `operations-health` version. Do not
  expose the database RPC to clients as a workaround.
- Database: use a new forward migration. Do not delete immutable accounting data,
  disable RLS, broaden function grants, or edit an applied migration.
- Client observability: remove or disable the adapter while keeping the no-op
  boundary. Monitoring failure must not prevent the app from operating.
- If health cannot be trusted, leave affected kill switches off and treat the
  system as degraded until reconciliation and the synthetic drill pass.
