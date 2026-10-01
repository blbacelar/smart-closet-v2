# Fitly Project Instructions

Read and follow `AGENTS.md` first.

## Product

Fitly is a privacy-first Expo mobile app for building a digital closet and generating AI try-ons. Phase 1 is the personal closet; the local second-hand marketplace is a later phase and must not displace the Phase 1 MVP.

## Stack

- Expo SDK 57, React Native 0.86, React 19.2, TypeScript strict mode
- Expo Router for file-based navigation
- Supabase for Auth, Postgres, private Storage, RLS, and Edge Functions
- TanStack Query for server state and Zustand for transient client state
- StyleSheet and shared color, type, spacing, radius, shadow, and motion tokens in `src/theme.ts`

## Current State

- The marketplace and some secondary screens remain a polished prototype backed by seeded data in `src/data.ts` and `src/store.ts`.
- Supabase is configured in `src/lib/supabase.ts` and the initial Phase 1 schema is deployed.
- Email/password authentication, Apple/Google OAuth client flows, persisted sessions, protected routing, first-run onboarding, and local-device sign-out are implemented. Social providers still require their external Supabase credentials.
- Body-photo camera/library capture, local validation, private Storage persistence, signed display URLs, and plan limits are implemented.
- Garment camera/library capture, validation, private Storage persistence, signed display URLs, live Closet/Studio queries, and Free-plan limits are implemented.
- The privileged garment background-removal worker, state machine, cost ledger, and Closet retry behavior are implemented and deployed.
- The cleanup provider still requires `REMOVE_BG_API_KEY` and `REMOVE_BG_COST_USD` as server-side secrets before a live image can complete.
- The Studio uses persisted private try-on jobs, server-authoritative quota, deterministic caching, one-time refunds, and a deployed direct Google Gemini image adapter instead of a simulated timer.
- `GOOGLE_GEMINI_API_KEY` is configured as a server-side secret; the Google project still needs available prepaid credits for a successful real-image smoke test.
- Persisted feedback, owner-filtered Realtime delivery, polling fallback, and scheduled stuck-job reconciliation are implemented.
- Do not present simulated timers or seeded records as working AI/backend behavior.

## Commands

- Start: `npm start`
- Typecheck: `npm run typecheck`
- Tests: `npm test`
- Coverage: `npm run test:coverage`
- Web production export: `npm run build:web`
- Expo compatibility check: `npx expo-doctor`

## Conventions

- Routes live in `app/`; shared UI in `src/components/`; service integrations in `src/lib/` or `src/api/`.
- Keep server state out of Zustand. Use Zustand only for local UI/capture state.
- User images remain private and must never enter analytics or logs.
- Enable RLS for every exposed table and scope image paths to the authenticated user ID.
- Sensitive provider and payment calls belong in Supabase Edge Functions, never the app bundle.
- Git history is too shallow to infer a reliable commit-message or PR convention.
