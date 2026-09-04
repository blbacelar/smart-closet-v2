# Fitly Onboarding Guide

## Overview

Fitly helps people photograph their clothes, organize a private digital closet, and preview garments on their own body with AI. The Phase 1 product is valuable for one person without a marketplace; local resale and donations are planned only after enough active closets exist in the Lower Mainland and Fraser Valley, BC.

The codebase is currently between prototype and MVP: authentication, account deletion, private body photos, private garment uploads, garment processing, and the persisted try-on pipeline are live. Privacy-safe observability, a global error fallback, reduced-motion preferences, and English/Brazilian Portuguese localization foundations are also in place. The Gemini key is configured, but its Google project needs prepaid credits before a successful real-image smoke test; garment cleanup still needs its development provider key. Subscriptions and marketplace screens still use pending or local sample behavior.

## Tech Stack

| Layer | Technology | Current version |
| --- | --- | --- |
| Language | TypeScript | 5.9 |
| Mobile framework | Expo / React Native | SDK 54 / RN 0.81 |
| UI runtime | React | 19.1 |
| Navigation | Expo Router | 6.0 |
| Localization | Expo Localization | 17.x |
| Server state | TanStack Query | 5.x |
| Local UI state | Zustand | 5.x |
| Backend | Supabase | Postgres, Auth, Storage, Edge Functions |
| Deployment | EAS | Development, preview, production profiles |

## Architecture

```text
Expo Router screens
  ├─ shared UI, design tokens, localization, and accessibility preferences
  ├─ privacy-safe observability boundary and global render fallback
  ├─ Zustand (temporary UI state; currently also seeded prototype data)
  └─ TanStack Query (authenticated photo, garment, job, and quota server state)
          │
          ▼
Supabase client
  ├─ Auth and profiles
  ├─ Postgres tables protected by RLS
  ├─ private body / garment / result buckets
  └─ Edge Functions for AI orchestration and other privileged work
          │
          ▼
Third-party providers
  ├─ remove.bg garment adapter (deployed; credentials pending)
  └─ Google Gemini image try-on adapter (deployed; credential configured)
```

The client never receives AI-provider, Stripe, or service-role secrets. Try-on currently uses asynchronous enqueue → Edge Function background task → direct Gemini generation → private result storage. The Studio subscribes to owner-filtered job updates through Supabase Realtime and retains polling as a connection-loss fallback. A five-minute database schedule marks jobs stale after ten minutes, safely fails at most 100 per run, and reuses the atomic one-time quota refund path.

## Key Entry Points

- `app/_layout.tsx` — global providers and root navigation.
- `app/sign-in.tsx` — thin route for email/password sign-in and account creation.
- `app/add-body-photo.tsx` — authenticated body-photo upload route.
- `app/(tabs)/_layout.tsx` — Closet, Studio, Market, and Profile tabs.
- `app/(tabs)/tryon.tsx` — live private inputs, persisted job status, stored results, and server quota display.
- `app/add-garment.tsx` — authenticated garment upload route.
- `app/delete-account.tsx` — destructive-confirmation route for permanent Phase 1 account deletion.
- `src/store.ts` — current in-memory prototype state.
- `src/lib/supabase.ts` — shared authenticated Supabase client.
- `src/lib/observability.ts` — allowlisted, privacy-safe analytics and error-reporting boundary; currently backed by a no-op adapter.
- `src/i18n/i18n.tsx` — device-locale resolution, English/Brazilian Portuguese messages, and interpolation.
- `src/providers/MotionPreferenceProvider.tsx` — system reduced-motion preference and duration helper.
- `src/components/AppErrorBoundary.tsx` — accessible global render-error fallback and safe error capture.
- `src/features/auth/` — validation, Supabase auth gateway, auth UI, and tests.
- `src/providers/AuthProvider.tsx` — session restoration and app-wide authenticated identity.
- `src/features/body-photos/` — capture, validation, private persistence, queries, UI, and tests.
- `src/features/garments/` — garment capture, validation, private persistence, queries, UI, and tests.
- `src/features/tryon/` — persisted jobs, quota queries, enqueue boundary, UI state, and tests.
- `supabase/functions/process-garment/` — authenticated, retryable garment preparation with a zero-cost original-image fallback and optional remove.bg cleanup.
- `supabase/migrations/20260804044556_initial_fitly_schema.sql` — deployed Phase 1 schema and RLS.
- `supabase/functions/tryon-enqueue/` — authenticated enqueue, background orchestration, and stateless direct Gemini adapter.
- `supabase/functions/delete-account/` — authenticated Storage purge followed by permanent Auth-user deletion.

## Current Data Flow

Today, authentication, body photos, garments, try-on jobs, and quota use Supabase. Images are validated locally, saved under authenticated private Storage paths, and displayed through short-lived signed URLs. Garment cleanup and try-on generation are isolated behind authenticated Edge Functions. Try-on cache keys are computed on the server, quota is reserved atomically, duplicate combinations reuse an existing job, results are copied from base64 provider output into private Storage, and failures refund quota once. Without provider secrets, the functions fail before spend; no simulated result is shown.

The intended live flow is:

1. Authenticate and obtain a Supabase user/profile.
2. Pick and compress a body or garment photo.
3. Upload it under a user-owned private Storage path.
4. Persist metadata in an RLS-protected table.
5. Invoke an Edge Function for validation, processing, or try-on.
6. Observe job completion and fetch a short-lived result URL.

## Directory Map

| Path | Purpose |
| --- | --- |
| `app/` | Expo Router screens and modal routes |
| `src/components/` | Shared visual components |
| `src/lib/` | Service clients and integration boundaries |
| `src/data.ts` | Seed data used by the prototype |
| `src/store.ts` | Zustand prototype/UI state |
| `supabase/migrations/` | Versioned database schema and policies |
| `supabase/functions/` | Server-side Edge Functions |
| `assets/` | App icons and splash assets |

## Implemented So Far

- Mobile-first Fitly visual system and four-tab navigation.
- Closet browsing and category filtering.
- Camera/library garment selection and editable garment metadata.
- Persisted try-on selection, progress, private result display, server-authoritative quota UI, and owner-only fit feedback.
- Marketplace preview, Pro paywall, and privacy/account settings UI.
- Expo SDK 54 compatibility for App Store Expo Go.
- Supabase client with persisted mobile sessions and app-state token refresh.
- Email/password sign-in and account creation with user profile metadata.
- Session-gated Expo Router routes, launch-time session restoration, and current-device sign-out.
- Jest/React Native Testing Library setup with an enforced 80% global coverage floor.
- Camera/library body-photo capture with local size, resolution, and orientation validation.
- Private body-photo Storage uploads, database metadata, signed URLs, and TanStack Query caching.
- Private garment Storage uploads, normalized metadata, signed URLs, TanStack Query caching, and live Closet/Studio rendering.
- Database-enforced one-photo Free and three-photo Pro limits.
- Database-enforced 50-garment Free limit, with unlimited Pro garment inserts.
- Hardened profile and body-photo permissions so clients cannot promote their own tier or approve moderation status.
- Hardened garment permissions so clients can edit descriptive metadata but cannot set cleanup paths, hashes, or processing state.
- Retryable, concurrency-safe garment processing state with three-attempt limits, stale-claim recovery, safe failure messages, and Closet retry controls.
- Authenticated `process-garment` Edge Function deployed with provider credentials isolated to server-side secrets.
- Atomic garment completion and background-removal cost ledger writes.
- Server-computed try-on cache keys and transaction-safe Free/Pro daily quota reservation.
- Idempotent try-on job claims, private base64 provider inputs/outputs, atomic completion/cost writes, and one-time quota refunds.
- Authenticated `tryon-enqueue` Edge Function and direct Gemini provider adapter deployed with JWT verification.
- Persisted thumbs-up/down try-on feedback with optimistic UI updates, owner-only database enforcement, and failure rollback.
- Owner-filtered Supabase Realtime job updates with query polling retained as a fallback.
- Scheduled, skip-locked recovery for interrupted try-on jobs with bounded batches and idempotent quota refunds.
- Permanent account deletion with typed confirmation, generic retry errors, private-object cleanup, Auth cascade deletion, and local cache/session clearing.
- Live-profile Storage guards that prevent a deleted user's unexpired JWT from accessing private image buckets.
- Deployed profiles, body photos, garments, usage, try-on jobs, and AI cost tables.
- RLS policies, private Storage buckets, indexes, constraints, and new-user profile trigger.
- Supabase security advisor verified with zero errors and zero warnings.
- GitHub Actions quality checks for locked install, typecheck, coverage, Expo Doctor, web export, and critical production advisories.
- Manual EAS build workflow defaulting to an Android preview, plus weekly npm and GitHub Actions dependency monitoring.
- Privacy-safe analytics/error hooks that allowlist event data, strip sensitive fields, and never forward raw error messages or image references.
- Accessible global render-error recovery, system reduced-motion detection, and English/Brazilian Portuguese localization scaffolding.
- A 32-assertion pgTAP suite covering RLS, anonymous access, owner isolation, private Storage boundaries, and allowed member mutations.
- A CI PII-leak gate that blocks runtime console logging, committed secrets, private signed Storage URLs, personal contact details, and developer home-directory paths without echoing detected values.
- Explicit least-privilege Data API grants and source-only private Storage writes, deployed through migration `20260904120000_explicit_authenticated_grants.sql`.

## Not Implemented Yet

- Automated body-photo content moderation and pose/quality scoring.
- A configured cleanup-provider credential and a real-image smoke test; the remove.bg adapter is deployed but intentionally cannot spend without secrets.
- Automatic garment category and color tagging.
- A successful real-image Gemini try-on smoke test after prepaid Google credits are available.
- RevenueCat subscriptions and real Pro entitlement checks.
- Sentry/GlitchTip and PostHog projects, adapters, credentials, consent policy, and broader event instrumentation; the current observability adapter intentionally sends nothing.
- Migration of existing screen copy into the localization catalog and a user-facing language selector.
- Broader feature/E2E tests and the `EXPO_TOKEN` needed for manual EAS builds.
- Marketplace tables and flows; those are intentionally Phase 2. The proposed annual-membership and exchange-credit direction is captured as discovery-only issue [#48](https://github.com/blbacelar/smart-closet-v2/issues/48) and is blocked on its product/legal/tax/store ADR.

## Common Tasks

- Run on a device: `npm start`, then scan the QR code with Expo Go.
- Typecheck: `npm run typecheck`.
- Run tests: `npm test`.
- Check auth coverage: `npm run test:coverage`.
- Run the local RLS suite: start Docker and Supabase, then run `npm run test:db`.
- Scan tracked first-party files for PII leakage: `npm run check:pii`.
- Validate Expo dependencies: `npx expo-doctor`.
- Build the web bundle: `npm run build:web`.
- Reproduce CI locally: run `npm ci`, typecheck, coverage, Expo Doctor, web export, and the critical-advisory audit in the same order as `.github/workflows/ci.yml`.
- Queue a native cloud build: add `EXPO_TOKEN` as a GitHub Actions secret, open the manual EAS workflow, and keep Android/preview selected until Apple credentials are available.
- Add a screen: create a route under `app/` and register it only when Expo Router cannot infer it.
- Add server data: create a typed function under `src/api/` and consume it through TanStack Query.
- Change the schema: add a new migration under `supabase/migrations/`, review RLS, apply it, and verify through the Data API.
- Optional garment cleanup: set `REMOVE_BG_API_KEY` and the real contracted `REMOVE_BG_COST_USD` in Supabase Edge Function secrets to enable background removal. Without them, the worker securely prepares the original garment JPEG at zero provider cost. Never put provider credentials in the app or committed files.
- Try-on configuration: `GOOGLE_GEMINI_API_KEY` is set in Supabase Edge Function secrets. The default model is `gemini-3.1-flash-image`, called through Google's Interactions API with `store: false`. Optional server-only overrides are `GOOGLE_GEMINI_IMAGE_MODEL` and `GOOGLE_GEMINI_TRYON_COST_USD_FALLBACK`. Never put the key in an `EXPO_PUBLIC_` variable or committed file.

## Recommended Build Order

1. Fund the configured Gemini project, configure the cleanup provider, and smoke-test both real-image paths. Reassess remove.bg before its announced December 2026 platform transition.
2. Add `EXPO_TOKEN` when an Android cloud build is needed, wire approved observability vendors after defining consent, then add Pro subscriptions, broader tests, and prepare the beta release.
3. Build the marketplace only after the Phase 1 activation and retention gates are credible.
