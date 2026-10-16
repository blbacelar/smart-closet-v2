# Fitly

Fitly is a privacy-first Expo app for building a digital closet and previewing your own clothes with AI try-on.

## Run locally

```bash
nvm use
npm install
npx expo login
npx expo start --clear
```

Fitly uses Expo SDK 57 and Node 22.13.0. Sign in to the same Expo account in the CLI and Expo Go, then scan the QR code. An Apple Developer account is not required for the general Expo Go workflow. Remote push registration is the exception: it requires a physical Fitly development build. You can also use an iOS/Android simulator or press `w` for the web preview.

The interface includes realistic development data so the complete Phase 1 flow can be reviewed without service credentials. To connect a Supabase project, copy `.env.example` to `.env` and provide the project URL and publishable key. Apply the migration in `supabase/migrations` before using live data.

Live Studio generation calls Gemini through OpenRouter's Image API from the `tryon-enqueue` Supabase Edge Function. Configure `OPENROUTER_API_KEY` as an Edge Function secret; never add it to the Expo environment or repository. The request pins the approved provider, disables fallbacks, requires privacy-preserving routing, aborts after 90 seconds, and never automatically repeats an ambiguous paid generation. The server uses a conservative `$0.10` ledger fallback when exact usage cost is unavailable; override it with `OPENROUTER_TRYON_COST_USD_FALLBACK` as pricing changes.

## Included

- Expo Router navigation and mobile-first UI
- Closet browsing, category filters, single or five-photo batch garment capture, automatic Gemini category suggestions, manual overrides, and keyboard-safe per-piece metadata editing
- Body-photo selection, stateless Gemini quality/safety validation, clear approval/rejection states, bounded retries, privacy guidance, and undoable per-photo deletion
- Interactive try-on flow, quota state, results, and feedback
- Realtime fitting completion with scheduled stale-job recovery
- Saved looks, Pro paywall, account/privacy settings, and permanent account deletion
- Supabase client boundary, private storage policies, RLS, quota tables, cost ledger, and enqueue function
- GitHub quality CI, manual EAS builds, and weekly dependency monitoring
- Explicit physical-device push registration, private token rotation/logout/deletion lifecycle, and a leased Expo ticket/receipt worker with a no-credential safe mode
- Privacy-safe observability hooks, accessible error recovery, reduced-motion support, and English/Brazilian Portuguese localization foundations
- pgTAP owner-isolation tests and a CI PII-leak gate that reports locations without echoing sensitive values
