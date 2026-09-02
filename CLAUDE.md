# Fitly Project Instructions

Read and follow `AGENTS.md` first.

## Product

Fitly is a privacy-first Expo mobile app for building a digital closet and generating AI try-ons. Phase 1 is the personal closet; the local second-hand marketplace is a later phase and must not displace the Phase 1 MVP.

## Stack

- Expo SDK 54, React Native 0.81, React 19, TypeScript strict mode
- Expo Router for file-based navigation
- Supabase for Auth, Postgres, private Storage, RLS, and Edge Functions
- TanStack Query for server state and Zustand for transient client state
- StyleSheet and shared tokens in `src/theme.ts`

## Current State

- The mobile UI is a polished prototype backed by seeded data in `src/data.ts` and `src/store.ts`.
- Supabase is configured in `src/lib/supabase.ts` and the initial Phase 1 schema is deployed.
- Email/password authentication, persisted sessions, protected routing, and local-device sign-out are implemented.
- The next implementation boundary is body-photo capture and owner-scoped private Storage persistence.
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
