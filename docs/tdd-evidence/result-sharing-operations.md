# Result sharing and operational hardening evidence

Date: 2026-09-30  
Backlog: T-025, T-028, T-029, T-033, T-034, T-035

## Delivered

- Added a 400 ms fade-and-scale result reveal with an immediate reduced-motion path.
- Captures the rendered result locally and invokes the native share sheet; the Free-tier FITLY watermark is embedded in the shared JPEG.
- Keeps private signed result URLs out of the share payload and replaces capture/provider errors with safe copy.
- Routes quota exhaustion and Profile upsell entry to the paywall sheet.
- Removed the prototype local Pro toggle; the Profile now reads the server-authoritative tier and the paywall truthfully defers purchases until RevenueCat/store setup is approved.
- Added service-role AI spend aggregation, RLS-protected warning/critical alert records, and hourly threshold evaluation.
- Instrumented privacy-safe activation, authentication, garment, try-on, paywall, and account-deletion events through the vendor-neutral observability boundary.
- Added an executable Maestro signup-to-fitting flow plus isolated fixture/account guidance.

## RED checkpoints

- `2bd6caa test: define result reveal and sharing`
- `43ef344 test: define AI cost operations`
- `cc25034 test: define product analytics funnels`
- `3d28ec9 test: define Maestro activation journey`

## GREEN checkpoints

- `73aa754 feat: reveal and share watermarked fittings`
- `bbc8132 feat: add AI cost dashboard and alerts`
- `49c3cb8 feat: instrument privacy-safe product funnels`
- `3fb0e80 test: add signup-to-tryon Maestro flow`

## Deployment

- Migration `20260930110000_ai_cost_operations.sql` is deployed to the linked Supabase project.
- Linked schema lint completed with no errors.
- Hourly alert thresholds currently default to USD 10 warning / USD 25 critical and can be changed by a reviewed forward migration.

## Remaining external evidence

- The Maestro flow requires a native preview build, fresh test account, non-personal fixtures, and funded Gemini image generation. It is committed and contract-tested but has not completed a real fitting while the configured Gemini project lacks prepaid credits.
- Analytics currently terminates at the privacy-safe no-op adapter. Connecting PostHog/Sentry or another approved vendor requires a consent policy and credentials.
- RevenueCat purchases remain intentionally unavailable pending the marketplace-membership/product decision and store credentials. No fake Pro entitlement is granted.
