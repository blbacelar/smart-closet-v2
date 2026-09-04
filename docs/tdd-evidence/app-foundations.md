# App Foundations TDD Evidence

Date: 2026-09-04  
Roadmap item: GitHub issue #5, “Observability + reduced-motion + i18n scaffold”

## Delivered Scope

- A vendor-neutral observability boundary with allowlisted analytics events and error context.
- Opaque authenticated-user IDs only; raw errors, image references, URLs, paths, email addresses, tokens, names, and other sensitive fields are not forwarded.
- A no-op production adapter so no telemetry leaves the app before a vendor, consent policy, and credentials are approved.
- An accessible global render-error fallback with a retry action.
- A provider that follows the operating system's reduced-motion preference and converts animation durations to zero when requested.
- Device-locale resolution with English and Brazilian Portuguese catalogs, English fallback, and message interpolation.
- Authentication lifecycle integration for safe user association and session-restore error reporting.

## Red Phase

- `5e1ed41 test: add app foundation contracts`
  - Added failing contracts for safe event filtering, safe error descriptors, locale resolution, interpolation, reduced-motion state, and the global error fallback.
- `f5f48f8 test: add auth observability contracts`
  - Added failing contracts for authenticated identity changes and session-restore failures.

The focused run failed because the new modules and Auth provider integration did not yet exist.

## Green Phase

- `c0a80d2 feat: add observable accessible app foundations`
  - Implemented the observability, localization, reduced-motion, error-boundary, and authentication integrations.
- `2e13354 refactor: emit app telemetry once per launch`
  - Moved the launch event into an effect so rendering cannot emit duplicate events.

Focused verification: 5 suites and 22 tests passed.

## Full Verification

- Jest: 35 suites and 207 tests passed.
- Coverage: 93.02% statements, 81.49% branches, 87.38% functions, and 93.91% lines.
- TypeScript: passed.
- Expo Doctor: 18/18 checks passed.
- Expo web export: passed.
- Production dependency audit at critical severity: passed with no critical advisories.

## Deferred Work

- Connect Sentry/GlitchTip and PostHog only after projects, server-side configuration, a consent policy, and credentials are available.
- Migrate existing screen copy into the localization catalogs and add a language selector.
- Adopt the motion-duration helper as animated interactions are introduced or revised.
- The SDK 54 dependency tree still reports 16 moderate and 9 high transitive advisories. A forced audit fix would jump to Expo SDK 57 and break the deliberate Expo Go compatibility decision, so that upgrade remains a release-planning task.
