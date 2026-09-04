# RLS and PII CI TDD Evidence

Date: 2026-09-04  
Roadmap item: GitHub issue #32, “RLS test suite (pgTAP) + PII scrubbing in CI”

## User Journeys

1. As a Fitly member, I can access only my own profile, photos, garments, usage, fittings, and private objects.
2. As a Fitly member, I cannot forge generated results, rewrite private objects, or mutate another member's records.
3. As a privacy-conscious member, I want every pull request to exercise database policies and reject common PII leaks before merge.
4. As a developer, I want a fresh local database to reproduce the same least-privilege Data API access as the hosted project.

## Red Evidence

- `90d7a65 test: add RLS and PII automation contracts`
  - The focused Jest run failed because the pgTAP suite, scripts, CI steps, and PII scanner did not exist.
  - It also detected an extensionless Deno import that prevented the Supabase CLI from building the local Edge Function graph.
- `628caaf test: expand PII leak detection contracts`
  - Added failing contracts for personal email addresses, phone numbers, and developer home-directory paths.
- First real `npm run test:db` execution failed because fresh databases had no explicit `authenticated` table grants. This demonstrated that policy definitions alone were not enough to reproduce the app's Data API contract.

## Green Evidence

- `edd77e3 feat: enforce database privacy in CI`
  - Added the scanner, pgTAP suite, CI database job, npm scripts, explicit Deno extension, isolated local ports, and a forward-only least-privilege migration.
  - The migration also removed a policy regression that allowed authenticated clients to upload generated results and update private Storage objects.

| # | Guarantee | Validation | Result |
| --- | --- | --- | --- |
| 1 | Six application tables and `storage.objects` have RLS enabled | `npm run test:db` | PASS |
| 2 | Members see only their records and private objects | `supabase/tests/database/rls.test.sql` | PASS |
| 3 | Cross-member profile, garment, photo, fitting, and object actions are denied | `supabase/tests/database/rls.test.sql` | PASS |
| 4 | Source images can be uploaded, but generated results cannot be forged and private objects cannot be rewritten | `supabase/tests/database/rls.test.sql` | PASS |
| 5 | Anonymous roles have no table read grants | `supabase/tests/database/rls.test.sql` | PASS |
| 6 | PII findings identify only file, line, and category and never repeat the detected value | `npm run check:pii` and `src/security/__tests__/piiScanner.test.ts` | PASS |
| 7 | CI starts a local Supabase stack and executes both privacy gates | `supabase/migrations/__tests__/securityAutomation.test.ts` | PASS |

## Full Verification

- pgTAP: 1 file and 32 assertions passed.
- Jest: 37 suites and 215 tests passed.
- Coverage: 93.02% statements, 81.49% branches, 87.38% functions, and 93.91% lines.
- TypeScript: passed.
- PII safety scan: passed.
- Local Supabase schema lint: passed with no errors.
- Expo Doctor: 18/18 checks passed.
- Expo web export: passed.
- Production dependency audit at critical severity: passed with no critical advisories.
- Hosted migration history confirms `20260904120000` was applied.
- GitHub Actions run [`33886647691`](https://github.com/blbacelar/smart-closet-v2/actions/runs/33886647691) passed both the app-quality and fresh-database RLS jobs.

## Known Gaps

- Hosted schema lint could not authenticate because `SUPABASE_DB_PASSWORD` is not available to the CLI session. The migration push and hosted migration-history verification both succeeded; only the linked lint remains unverified.
- Storage's statement-level deletion guard prevents direct SQL execution of delete-policy branches. The suite verifies owner visibility plus the exact delete-policy presence and owner/live-profile predicates; Storage API deletion remains covered by the application account-deletion tests.
- The SDK 54 dependency tree retains 16 moderate and 9 high transitive advisories. The critical-severity gate passes, and the breaking SDK 57 upgrade remains deferred to preserve current Expo Go compatibility.
