# Fitly Onboarding Guide

## Overview

Fitly helps people photograph their clothes, organize a private digital closet, and preview garments on their own body with AI. The Phase 1 product is valuable for one person without a marketplace; local resale and donations are planned only after enough active closets exist in the Lower Mainland and Fraser Valley, BC.

The codebase is currently between prototype and MVP: authentication and private body photos are live, while garments, try-ons, subscriptions, and marketplace screens still use local sample behavior.

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
  └─ TanStack Query (intended server-state boundary)
          │
          ▼
Supabase client
  ├─ Auth and profiles
  ├─ Postgres tables protected by RLS
  ├─ private body / garment / result buckets
  └─ Edge Functions for AI orchestration and other privileged work
          │
          ▼
Third-party AI provider (not connected yet)
```

The client must never receive AI-provider, Stripe, or service-role secrets. Try-on is designed as an asynchronous enqueue → provider → webhook → Realtime flow.

## Key Entry Points

- `app/_layout.tsx` — global providers and root navigation.
- `app/sign-in.tsx` — thin route for email/password sign-in and account creation.
- `app/add-body-photo.tsx` — authenticated body-photo upload route.
- `app/(tabs)/_layout.tsx` — Closet, Studio, Market, and Profile tabs.
- `app/(tabs)/tryon.tsx` — prototype try-on journey and quota display.
- `app/add-garment.tsx` — image picker and prototype garment creation.
- `src/store.ts` — current in-memory prototype state.
- `src/lib/supabase.ts` — shared authenticated Supabase client.
- `src/features/auth/` — validation, Supabase auth gateway, auth UI, and tests.
- `src/providers/AuthProvider.tsx` — session restoration and app-wide authenticated identity.
- `src/features/body-photos/` — capture, validation, private persistence, queries, UI, and tests.
- `supabase/migrations/20260804044556_initial_fitly_schema.sql` — deployed Phase 1 schema and RLS.
- `supabase/functions/tryon-enqueue/index.ts` — initial authenticated enqueue boundary; it creates jobs but does not call an AI provider yet.

## Current Data Flow

Today, authentication and body photos use Supabase. A body photo can be captured or selected, checked for upload size, resolution, and portrait orientation, saved under the authenticated user's private Storage path, and displayed through a short-lived signed URL. Garments and try-on results remain simulated: a user selects an Unsplash-backed garment, starts a timer, and sees their body photo without a generated garment composite. Adding a garment still prepends a local image to Zustand rather than uploading it.

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
- Simulated try-on states, quota display, feedback controls, and saved-look UI.
- Marketplace preview, Pro paywall, and privacy/account settings UI.
- Expo SDK 54 compatibility for App Store Expo Go.
- Supabase client with persisted mobile sessions and app-state token refresh.
- Email/password sign-in and account creation with user profile metadata.
- Session-gated Expo Router routes, launch-time session restoration, and current-device sign-out.
- Jest/React Native Testing Library setup with an enforced 80% coverage floor for auth.
- Camera/library body-photo capture with local size, resolution, and orientation validation.
- Private body-photo Storage uploads, database metadata, signed URLs, and TanStack Query caching.
- Database-enforced one-photo Free and three-photo Pro limits.
- Hardened profile and body-photo permissions so clients cannot promote their own tier or approve moderation status.
- Deployed profiles, body photos, garments, usage, try-on jobs, and AI cost tables.
- RLS policies, private Storage buckets, indexes, constraints, and new-user profile trigger.
- Supabase security advisor verified with zero errors and zero warnings.

## Not Implemented Yet

- Automated body-photo content moderation and pose/quality scoring.
- Persisted garment uploads, background removal, or automatic tagging.
- Real AI-provider integration, webhook completion, result storage, and Realtime updates.
- Atomic quota accounting, cache-key generation, and quota refunds on failure.
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

## Recommended Build Order

1. Garment upload, processing status, and live closet query.
2. End-to-end try-on provider, caching, quota, and feedback.
3. Pro subscriptions, deletion, observability, broader tests, and beta release.
4. Marketplace only after the Phase 1 activation and retention gates are credible.
