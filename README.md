# Fitly

Fitly is a privacy-first Expo app for building a digital closet and previewing your own clothes with AI try-on.

## Run locally

```bash
npm install
npm start
```

Open the app with Expo Go, an iOS/Android simulator, or press `w` for the web preview.

The interface includes realistic development data so the complete Phase 1 flow can be reviewed without service credentials. To connect a Supabase project, copy `.env.example` to `.env` and provide the project URL and publishable key. Apply the migration in `supabase/migrations` before using live data.

Live Studio generation calls Google Gemini directly from the `tryon-enqueue` Supabase Edge Function. Configure `GOOGLE_GEMINI_API_KEY` as an Edge Function secret; never add it to the Expo environment or repository.

## Included

- Expo Router navigation and mobile-first UI
- Closet browsing, search, category filters, and garment capture
- Body-photo selection and privacy guidance
- Interactive try-on flow, quota state, results, and feedback
- Realtime fitting completion with scheduled stale-job recovery
- Saved looks, Pro paywall, account/privacy settings, and permanent account deletion
- Supabase client boundary, private storage policies, RLS, quota tables, cost ledger, and enqueue function
- GitHub quality CI, manual EAS builds, and weekly dependency monitoring
- Privacy-safe observability hooks, accessible error recovery, reduced-motion support, and English/Brazilian Portuguese localization foundations
