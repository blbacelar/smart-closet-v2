# CI pipeline TDD evidence

## Source and user journeys

This slice implements the repository-controlled portion of GitHub issue #4.

- As a contributor, I want every pull request and main-branch push to run the same quality checks used locally.
- As the project owner without an Apple Developer account, I want native cloud builds to be manual and default to an Android preview.
- As the maintainer, I want dependency updates surfaced without granting CI write access or exposing application secrets.

## RED checkpoint

- Commit: `263702c test: add CI pipeline contracts`
- Command: `npm test -- --runTestsByPath tooling/__tests__/ciConfiguration.test.ts`
- Result: the suite failed because `.github/workflows/ci.yml` did not exist. This was the intended missing-pipeline failure.

## GREEN checkpoint

- Commit: `b1fa87b ci: add quality and manual EAS workflows`
- Command: `npm test -- --runTestsByPath tooling/__tests__/ciConfiguration.test.ts`
- Result: 1 suite passed, 9 tests passed.

## Test specification

| # | What is guaranteed | Test target | Type | Result |
| --- | --- | --- | --- | --- |
| 1 | Pull requests and main pushes trigger quality CI with read-only repository permissions and no application secrets | `ciConfiguration.test.ts` | configuration/security | PASS |
| 2 | CI installs from the lockfile and runs typecheck, coverage, Expo Doctor, web export, and a critical production-advisory gate | `ciConfiguration.test.ts` | configuration | PASS |
| 3 | Superseded quality runs are cancelled and jobs have a bounded timeout | `ciConfiguration.test.ts` | configuration | PASS |
| 4 | EAS builds can only be started manually and default to an Android preview | `ciConfiguration.test.ts` | configuration/cost control | PASS |
| 5 | Only the manual EAS boundary reads `EXPO_TOKEN`, and builds are queued non-interactively without waiting | `ciConfiguration.test.ts` | configuration/security | PASS |
| 6 | npm and GitHub Actions dependencies are checked weekly | `ciConfiguration.test.ts` | configuration | PASS |
| 7 | CI uses Node 22.13, the minimum baseline documented for the planned Expo SDK 57 upgrade | `ciConfiguration.test.ts` | configuration | PASS |

## Full verification

The quality workflow was reproduced locally in order:

- `npm ci`: locked install completed.
- `npm run typecheck`: passed.
- `npm run test:coverage -- --ci`: 31 suites and 191 tests passed; 93.39% statements, 81.57% branches, 88.1% functions, and 94.13% lines.
- `npx expo-doctor`: 18/18 checks passed.
- `npm run build:web`: Expo web export completed.
- `npm audit --omit=dev --audit-level=critical`: passed with no critical advisories.
- Ruby YAML parsing: `ci.yml`, `eas-build.yml`, and `dependabot.yml` parsed successfully.

The workflow was then published to `main`. GitHub Actions run
[`33886647691`](https://github.com/blbacelar/smart-closet-v2/actions/runs/33886647691)
completed successfully: both the app-quality job and the fresh-database RLS job passed.

## Known gaps

- The manual EAS job requires an `EXPO_TOKEN` GitHub Actions secret. No Actions secrets are currently configured, so no native build was queued.
- iOS remains an explicit manual choice because the owner does not yet have Apple signing credentials.
- The critical-only audit gate intentionally does not hide the 16 moderate and 9 high transitive advisories in Expo SDK 54. Dependabot will surface updates, and the breaking SDK 57 upgrade remains required before production release.
