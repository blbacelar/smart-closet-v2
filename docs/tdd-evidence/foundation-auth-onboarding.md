# Foundation, social authentication, and onboarding evidence

Date: 2026-09-30  
Backlog: T-002, T-006, T-007

## Delivered

- Completed the shared Fitly token contract for color, typography, spacing, radius, shadow, and motion while retaining the existing StyleSheet architecture.
- Added accessible Google and Apple provider buttons backed by Supabase OAuth and Expo WebBrowser auth sessions.
- Added a persisted `profiles.onboarding_completed_at` field with least-privilege column grants.
- Added a protected, privacy-focused onboarding journey and launch-time routing for incomplete profiles.

The original NativeWind-specific implementation note in T-002 was superseded by the app's established shared-token/StyleSheet architecture. The product-level design-system contract is complete without carrying two styling systems.

## RED checkpoints

- `70eee6a test: define design token contract`
- `e3b22ee test: define social authentication flow`
- `c5c70fb test: define persisted onboarding journey`

Each focused suite failed for the intended missing tokens, OAuth gateway/UI, profile repository, onboarding UI, and migration.

## GREEN checkpoints

- `083a626 feat: complete shared design tokens`
- `004aa71 feat: add Apple and Google sign-in flows`
- `18a9d1f feat: persist first-run onboarding`

## Verification

- 56 Jest suites and 333 tests passed.
- Coverage: 92.57% statements, 81.39% branches, 87.46% functions, 94.09% lines.
- TypeScript, PII scan, Expo Doctor 21/21, and Expo web export passed.
- Remote Supabase schema lint passed with no errors.
- Migration `20260930090000_profile_onboarding.sql` is present locally and remotely.

## External provider setup

Email/password authentication and session handling work today. Google and Apple client flows are complete, but each provider must also be enabled in the Supabase dashboard with its platform credentials and allowed redirect URLs. Apple production credentials require the Apple Developer account the owner has intentionally deferred.
