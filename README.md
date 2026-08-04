# Fitly

Fitly is a privacy-first Expo app for building a digital closet and previewing your own clothes with AI try-on.

## Run locally

```bash
npm install
npm start
```

Open the app with Expo Go, an iOS/Android simulator, or press `w` for the web preview.

The interface includes realistic development data so the complete Phase 1 flow can be reviewed without service credentials. To connect a Supabase project, copy `.env.example` to `.env` and provide the project URL and publishable key. Apply the migration in `supabase/migrations` before using live data.

## Included

- Expo Router navigation and mobile-first UI
- Closet browsing, search, category filters, and garment capture
- Body-photo selection and privacy guidance
- Interactive try-on flow, quota state, results, and feedback
- Saved looks, Pro paywall, and account/privacy settings
- Supabase client boundary, private storage policies, RLS, quota tables, cost ledger, and enqueue function

