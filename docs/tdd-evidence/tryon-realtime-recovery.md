# TDD Evidence: Try-On Realtime and Stuck-Job Recovery

- Source: Phase 1 reliability roadmap and official Supabase [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) and [Cron](https://supabase.com/docs/guides/cron/quickstart) guidance
- Completed: 2026-09-03
- Framework: Jest 29, jest-expo 54, React Native Testing Library 14, and Supabase CLI 2.113

## User Journey

As a Fitly member waiting for a private fitting, I see the result or safe failure as soon as its job changes, retain polling protection if the socket is unavailable, and regain reserved quota when an interrupted server task leaves the job stale.

## RED

Command:

`npm test -- --runTestsByPath src/features/tryon/__tests__/tryonRealtime.test.ts src/features/tryon/__tests__/useTryOns.test.tsx supabase/migrations/__tests__/tryonReliabilityMigration.test.ts`

Result: 3 suites failed. The private Realtime adapter and hook did not exist, and the reliability migration was absent.

Checkpoint: `dcfec24 test: add try-on realtime and recovery contracts`

## GREEN Guarantees

| Guarantee | Evidence |
| --- | --- |
| Each subscription receives only updates matching the authenticated member ID | Realtime adapter contract test |
| The subscription watches updates to `public.tryon_jobs` | Realtime adapter contract test |
| Job and quota caches refresh on each event | React Query hook integration test |
| Signed-out sessions create no private channel | Hook integration test |
| Channels are removed when Studio unmounts | Adapter and hook cleanup tests |
| Realtime gracefully stays inert without Supabase configuration | Shared-client boundary test |
| Publication setup is idempotent | Migration contract checks `pg_publication_tables` first |
| Recovery processes only stale queued/running jobs | Migration contract and interval validation |
| Concurrent recovery workers do not claim the same row | `FOR UPDATE SKIP LOCKED` migration contract |
| A run handles at most 100 jobs | Bounded migration implementation |
| Existing one-time quota-refund behavior is reused | Recovery delegates to `fail_tryon_job` |
| Reconciliation is privileged and runs every five minutes | Function grants and named `pg_cron` schedule |

Implementation checkpoint: `8eee8fb feat: add realtime try-on recovery`

## Deployment and Verification

- Migration dry run identified only `20260903010000_tryon_realtime_recovery.sql`.
- Migration `20260903010000` applied successfully to the linked development Supabase project.
- Remote and local migration histories match.
- Supabase linked-database lint: no schema errors.
- Focused tests: 3 suites and 14 tests passing.
- Full suite: 26 suites and 156 tests passing.
- Coverage: 93.07% statements, 80.41% branches, 87.57% functions, and 93.75% lines.
- TypeScript check: PASS.
- Expo Doctor: 18/18 checks passed.
- Expo web export: PASS.
- Local Gemini and legacy OpenRouter secret values were checked without printing them and are not embedded in the exported bundle.

## Known Gap and Rollback

The automated suite validates the client subscription contract and deployed database schema, but does not synthesize a live authenticated websocket event on a physical device. Polling remains active as the operational fallback. The migration contains a forward rollback plan: unschedule the named Cron job, remove the function, and remove `tryon_jobs` from the publication only after confirming that no other client consumes it.
