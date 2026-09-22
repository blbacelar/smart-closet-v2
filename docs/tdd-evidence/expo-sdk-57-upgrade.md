# Expo SDK 57 upgrade TDD evidence

## User problem

The current App Store build of Expo Go supports SDK 57, while Fitly still declared SDK 54. On a physical iPhone, Expo Go therefore rejected the QR-code project as incompatible. iOS does not provide a supported way to install an older Expo Go build on a physical device.

## RED checkpoint

- Commit: `b646122 test: reproduce Expo Go SDK 57 mismatch`.
- Command: `npm test -- --runInBand tooling/__tests__/expoSdk57Configuration.test.ts`.
- Result: two assertions failed because the project declared Expo/Jest SDK 54 packages instead of SDK 57.

## GREEN checkpoint

- Commit: `801adb9 fix: upgrade Fitly to Expo SDK 57`.
- The project now uses Expo 57.0.24, React Native 0.86.3, React 19.2.3, and TypeScript 6.0.3.
- Reanimated 4.5.1 and Worklets 0.10.1 are pinned to Expo 57's supported native-module set, preventing npm from selecting incompatible optional peer versions.
- Jest globals are explicitly included for TypeScript 6, and `expo-modules-core` remains a transitive Expo dependency as required by Expo Doctor.

## Verification

| Check | Result |
| --- | --- |
| SDK configuration contract | 3 tests passed |
| Full Jest suite | 48 suites and 295 tests passed |
| Coverage | 92.85% statements, 81.15% branches, 87.87% functions, 94.15% lines |
| TypeScript | Passed |
| Expo dependency check | Dependencies are up to date |
| Expo Doctor | 21/21 checks passed |
| Web production export | Passed |
| iOS production JavaScript export | Passed; 3,250 modules bundled |
| PII safety scan | Passed |
| Critical production audit gate | Passed with no critical advisories |

The dependency tree still reports 13 moderate and one high advisory. The available forced fixes would downgrade core Expo packages across incompatible major versions, so they were not applied. Weekly dependency monitoring remains responsible for upstream-compatible remediations.

## Local Expo Go workflow

Use Node 22.13.0, install the lockfile, sign in to the same Expo account in the CLI and Expo Go, and restart Metro with a clean cache:

```bash
nvm use
npm install
npx expo login
npx expo start --clear
```

This development workflow uses Expo Go and does not require an Apple Developer account.
