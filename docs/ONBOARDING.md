# Fitly Onboarding Guide

## Overview

Fitly helps people photograph their clothes, organize a private digital closet, and preview garments on their own body with AI. The Phase 1 product is valuable for one person without a marketplace; local resale and donations are planned only after enough active closets exist in the Lower Mainland and Fraser Valley, BC.

The codebase is currently between prototype and MVP: authentication, private body photos, private garment uploads, garment processing, and the persisted try-on pipeline are live. The OpenRouter key is configured; garment cleanup still needs its development provider key before both real-image paths can be smoke-tested. Subscriptions and marketplace screens still use pending or local sample behavior.

## Tech Stack

| Layer | Technology | Current version |
| --- | --- | --- |
| Language | TypeScript | 5.9 |
| Mobile framework | Expo / React Native | SDK 54 / RN 0.81 |
| UI runtime | React | 19.1 |
| Navigation | Expo Router | 6.0 |
| Server state | TanStack Query | 5.x |
| Local UI state | Zustand | 5.x |
| Backend | Supabase | Postgres, Auth, Storage, Edge Functions |
| Deployment | EAS | Development, preview, production profiles |

## Architecture

```text
Expo Router screens
  ├─ shared UI and design tokens
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
  └─ OpenRouter image try-on adapter (deployed; credential configured)
```

The client never receives AI-provider, Stripe, or service-role secrets. Try-on currently uses asynchronous enqueue → Edge Function background task → OpenRouter generation → private result storage, while the app polls the owner-scoped job row. Realtime delivery and scheduled stuck-job reconciliation remain planned hardening.

## Key Entry Points

- `app/_layout.tsx` — global providers and root navigation.
- `app/sign-in.tsx` — thin route for email/password sign-in and account creation.
- `app/add-body-photo.tsx` — authenticated body-photo upload route.
- `app/(tabs)/_layout.tsx` — Closet, Studio, Market, and Profile tabs.
- `app/(tabs)/tryon.tsx` — live private inputs, persisted job status, stored results, and server quota display.
- `app/add-garment.tsx` — authenticated garment upload route.
- `src/store.ts` — current in-memory prototype state.
- `src/lib/supabase.ts` — shared authenticated Supabase client.
- `src/features/auth/` — validation, Supabase auth gateway, auth UI, and tests.
- `src/providers/AuthProvider.tsx` — session restoration and app-wide authenticated identity.
- `src/features/body-photos/` — capture, validation, private persistence, queries, UI, and tests.
- `src/features/garments/` — garment capture, validation, private persistence, queries, UI, and tests.
- `src/features/tryon/` — persisted jobs, quota queries, enqueue boundary, UI state, and tests.
- `supabase/functions/process-garment/` — authenticated, retryable garment preparation with a zero-cost original-image fallback and optional remove.bg cleanup.
- `supabase/migrations/20260804044556_initial_fitly_schema.sql` — deployed Phase 1 schema and RLS.
- `supabase/functions/tryon-enqueue/` — authenticated enqueue, background orchestration, and stateless direct Gemini adapter.

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
- Persisted try-on selection, progress, private result display, and server-authoritative quota UI.
- Marketplace preview, Pro paywall, and privacy/account settings UI.
- Expo SDK 54 compatibility for App Store Expo Go.
- Supabase client with persisted mobile sessions and app-state token refresh.
- Email/password sign-in and account creation with user profile metadata.
- Session-gated Expo Router routes, launch-time session restoration, and current-device sign-out.
- Jest/React Native Testing Library setup with an enforced 80% coverage floor for auth.
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
- Authenticated `tryon-enqueue` Edge Function and OpenRouter provider adapter deployed with JWT verification.
- Deployed profiles, body photos, garments, usage, try-on jobs, and AI cost tables.
- RLS policies, private Storage buckets, indexes, constraints, and new-user profile trigger.
- Supabase security advisor verified with zero errors and zero warnings.

## Not Implemented Yet

- Automated body-photo content moderation and pose/quality scoring.
- A configured cleanup-provider credential and a real-image smoke test; the remove.bg adapter is deployed but intentionally cannot spend without secrets.
- Automatic garment category and color tagging.
- A paid real-image OpenRouter try-on smoke test.
- Persisted thumbs feedback, Realtime delivery, and scheduled recovery for jobs interrupted with the Edge Function.
- RevenueCat subscriptions and real Pro entitlement checks.
- Account deletion, analytics, error monitoring, broader feature tests, and CI.
- Marketplace tables and flows; those are intentionally Phase 2.

## Common Tasks

- Run on a device: `npm start`, then scan the QR code with Expo Go.
- Typecheck: `npm run typecheck`.
- Run tests: `npm test`.
- Check auth coverage: `npm run test:coverage`.
- Validate Expo dependencies: `npx expo-doctor`.
- Build the web bundle: `npm run build:web`.
- Add a screen: create a route under `app/` and register it only when Expo Router cannot infer it.
- Add server data: create a typed function under `src/api/` and consume it through TanStack Query.
- Change the schema: add a new migration under `supabase/migrations/`, review RLS, apply it, and verify through the Data API.
- Optional garment cleanup: set `REMOVE_BG_API_KEY` and the real contracted `REMOVE_BG_COST_USD` in Supabase Edge Function secrets to enable background removal. Without them, the worker securely prepares the original garment JPEG at zero provider cost. Never put provider credentials in the app or committed files.
- Try-on configuration: `GOOGLE_GEMINI_API_KEY` is set in Supabase Edge Function secrets. The default model is `gemini-3.1-flash-image`, called through Google's Interactions API with `store: false`. Optional server-only overrides are `GOOGLE_GEMINI_IMAGE_MODEL` and `GOOGLE_GEMINI_TRYON_COST_USD_FALLBACK`. Never put the key in an `EXPO_PUBLIC_` variable or committed file.

## Recommended Build Order

1. Configure the image-processing providers and smoke-test garment cleanup plus one real OpenRouter try-on. Reassess remove.bg before its announced December 2026 platform transition.
2. Persist try-on feedback and add Realtime delivery plus scheduled stuck-job reconciliation.
3. Pro subscriptions, deletion, observability, broader tests, and beta release.
4. Marketplace only after the Phase 1 activation and retention gates are credible.
