# Fitly Maestro smoke test

## Installed SDK 57 development build and two-account market

Fitly uses `expo-dev-client` for native acceptance work. The EAS profiles are:

- `development` for a signed physical-device development client;
- `development-simulator` for an unsigned iOS Simulator development client;
- `staging` for an internally distributed staging build (`.apk` on Android).

The app uses the `appVersion` runtime policy. Increment `expo.version` whenever
native dependencies or native app configuration change before publishing an
update for a previously distributed binary.

For a local smoke, start Supabase with Auth, Storage, and PostgREST available,
then run `npm run e2e:seed`. The command discovers the local URL and service-role
key from `supabase status`, creates or refreshes two synthetic accounts, uploads
the committed non-personal garment fixture, and idempotently prepares active
memberships, credit balances, a ready garment, and one marketplace listing.

For a remote target, use only a non-production staging project. Provide the
following variables in the shell: `E2E_SUPABASE_URL`,
`E2E_SUPABASE_SERVICE_ROLE_KEY`, `E2E_SEED_ALLOW_REMOTE` with the exact value
`staging`, `E2E_SEED_STAGING_PROJECT_REF` matching the project ref in the URL,
`E2E_SELLER_PASSWORD`, and `E2E_BUYER_PASSWORD`. Remote identities must use the
reserved `fitly-e2e…@example.com` or `fitly-e2e…@example.test` namespace. The
script refuses to take over an unmarked account or reset a fixture after offers,
transactions, or non-seed ledger entries exist; use fresh identities or reset
the isolated staging project instead. Never expose the service-role key to Expo,
Maestro, a checked-in file, or a production build.

After installing the development build and starting Metro against the same
Supabase target, run:

```bash
maestro test \
  -e EXPO_URL="exp+fitly://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081" \
  -e E2E_SELLER_EMAIL="fitly-e2e-seller@example.com" \
  -e E2E_SELLER_PASSWORD="FitlyE2ESeller2026" \
  -e E2E_BUYER_EMAIL="fitly-e2e-buyer@example.com" \
  -e E2E_BUYER_PASSWORD="FitlyE2EBuyer2026" \
  .maestro/two-account-marketplace-smoke.yaml
```

Those published passwords are synthetic local defaults, not credentials for a
shared environment. Remote staging must supply different secret values.

`expo-go-auth-smoke.yaml` is a no-credential simulator check for the authentication shell. Start Fitly in Expo Go first, then run:

```bash
maestro --device=<simulator-udid> test \
  -e EXPO_URL="exp://<address-shown-by-expo>:8088" \
  .maestro/expo-go-auth-smoke.yaml
```

It verifies the SDK 57 Expo Go launch, both social-auth entry points, and the email sign-in/sign-up mode transition without creating an account or transmitting test data.

`expo-go-signup-to-tryon.yaml` runs the same real provider journey as the preview-build flow through Expo Go. The repository includes two synthetic, non-personal fixtures generated specifically for automation:

- `.maestro/fixtures/synthetic-adult-body.jpg`
- `.maestro/fixtures/synthetic-green-overshirt.jpg`

Run it against a live Metro server with a fresh isolated email:

```bash
maestro --device=<simulator-udid> test \
  -e EXPO_URL="exp://127.0.0.1:8088" \
  -e E2E_EMAIL="fitly-e2e+$(date +%s)@example.test" \
  -e E2E_PASSWORD="replace-with-test-password" \
  .maestro/expo-go-signup-to-tryon.yaml
```

## Full activation journey

`signup-to-tryon.yaml` exercises a real isolated account from signup through onboarding, private body-photo upload, garment upload, and a completed AI fitting. It targets an installed iOS preview build with application ID `app.fitly.mobile`; it is not a simulated UI test.

Prerequisites:

- Install Maestro and a Fitly preview build on a simulator/emulator.
- Use a fresh `E2E_EMAIL` on every run and an `E2E_PASSWORD` of at least eight characters. Development email confirmation must remain disabled for this test project.
- The flow enters a synthetic adult date solely to exercise the 18+ eligibility gate. Fitly stores only the resulting confirmation timestamp, not the date.
- The committed synthetic fixtures are used automatically. Replace them only with non-personal test media that satisfy the app's size/orientation rules; never commit personal photos.
- The linked Supabase project must have deployed migrations/functions and a Gemini project with available prepaid credits. A successful fitting intentionally spends one real provider request; Google returns HTTP 402 when those credits are depleted.

Run:

```bash
maestro test \
  -e E2E_EMAIL="fitly-e2e+$(date +%s)@example.test" \
  -e E2E_PASSWORD="replace-with-test-password" \
  .maestro/signup-to-tryon.yaml
```

The operating-system picker layout differs slightly by OS release. The iOS flow selects the two imported fixtures through the native Photos grid; keep the test simulator gallery empty before a run. Never use a production member account or personal images.
