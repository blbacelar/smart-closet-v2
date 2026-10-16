# CI, RLS, and marketplace baseline TDD evidence

Date: 2026-10-15  
Roadmap slice: C01  
GitHub authority: #67

## User journeys

1. As a contributor, I can run one command from a clean checkout and reproduce every CI quality gate, including a fresh database and RLS tests.
2. As an adult Fitly member, I can upload private body and garment media while an account without adult confirmation cannot create either the records or source objects.
3. As a marketplace member, membership, listing, offer, transaction, handoff, cancellation, and chat repository behavior is included in enforceable coverage.
4. As a maintainer, Expo SDK 57 tooling and dependency risk decisions are locked, reviewable, and cannot silently change between runs.

## RED checkpoints

- `56cb3fe test: expose CI coverage and adult RLS gaps`
  - Marketplace code was absent from collection.
  - The executable RLS suite exposed the adult-confirmation upload regression.
- `d39c71d test: require reproducible local quality gates`
  - The quality runner and audited `shell-quote` override did not exist.
- `8d26a57 test: require deterministic complete quality gates`
  - Expo Doctor was not locked, the runner omitted pgTAP, and CI started an unnecessarily broad Supabase stack.
- `1ea5fb7 test: require self-contained database quality gate`
  - A clean checkout could not run the database gate in one command.
- `dcad667 test: require pending database migrations in quality gate`
  - A pre-existing Supabase stack could be tested against a stale schema.

## GREEN checkpoints

- `3d40724 fix: enforce adult eligibility for private media`
  - Removed broad permissive media policies and recreated operation-specific insert policies with adult confirmation.
  - Added a bounded migration contract and executable pgTAP assertions.
- `6c14247 ci: restore reproducible SDK 57 quality gates`
  - Added the complete quality runner, SDK 57 patch alignment, locked Expo Doctor, critical advisory remediation, high-risk register, minimal database CI, marketplace coverage ownership, and marketplace flow tests.

## Verification

| Guarantee | Evidence | Result |
| --- | --- | --- |
| Clean dependency install is reproducible | `npm ci` | PASS |
| TypeScript is sound | `npm run typecheck` | PASS |
| Marketplace and application tests meet global thresholds | 79 suites, 457 tests; 91.03% statements, 80.06% branches, 84.52% functions, 92.5% lines | PASS |
| PII scanner remains green | `npm run check:pii` | PASS |
| SDK 57 package set is compatible and the checker is locked | `npm exec --offline expo-doctor`; 21/21 checks | PASS |
| Web bundle exports | `npm run build:web` | PASS |
| No critical production advisory remains | `npm audit --omit=dev --audit-level=critical` | PASS |
| Remaining high roots have an owner, review date, exposure analysis, and exit condition | `docs/security/dependency-risk-register.md` | PASS |
| Fresh schema applies every forward migration | runner-managed minimal `supabase start` plus `supabase migration up --local` | PASS |
| Database security policies execute successfully | `npm run test:db`; pgTAP 50/50 | PASS |
| Runner preserves a pre-existing local stack | `npm run quality` followed by successful `supabase status` | PASS |
| Runner cleans a stack it created | clean `npm run quality` followed by absent `supabase status` | PASS |
| Schema lint has no errors | `supabase db lint --local --level error` | PASS |
| Independent review has no remaining findings | ECC review after two repair rounds | PASS |

## Remote exit gate

Issue #67 remains open until two consecutive GitHub Actions runs pass. The first run is
triggered by the C01 pull request; after it passes, the branch receives a no-op-equivalent
documentation update or rerun so the second independent run can be recorded before merge.
