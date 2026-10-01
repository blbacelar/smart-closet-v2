# Fitly Maestro smoke test

`expo-go-auth-smoke.yaml` is a no-credential simulator check for the authentication shell. Start Fitly in Expo Go first, then run:

```bash
maestro --device=<simulator-udid> test \
  -e EXPO_URL="exp://127.0.0.1:8088" \
  .maestro/expo-go-auth-smoke.yaml
```

It verifies the SDK 57 Expo Go launch, both social-auth entry points, and the email sign-in/sign-up mode transition without creating an account or transmitting test data.

## Full activation journey

`signup-to-tryon.yaml` exercises a real isolated account from signup through onboarding, private body-photo upload, garment upload, and a completed AI fitting. It targets an installed Android/iOS preview build with application ID `app.fitly.mobile`; it is not a simulated UI test.

Prerequisites:

- Install Maestro and a Fitly preview build on a simulator/emulator.
- Use a fresh `E2E_EMAIL` on every run and an `E2E_PASSWORD` of at least eight characters. Development email confirmation must remain disabled for this test project.
- Provide absolute `E2E_BODY_PHOTO` and `E2E_GARMENT_PHOTO` paths. The body fixture must clearly show one adult from head to toe; both images must satisfy the app's size/orientation rules. Do not commit personal photos.
- The linked Supabase project must have deployed migrations/functions and a funded Gemini project. A successful fitting intentionally spends one real provider request.

Run:

```bash
maestro test \
  -e E2E_EMAIL="fitly-e2e+$(date +%s)@example.test" \
  -e E2E_PASSWORD="replace-with-test-password" \
  -e E2E_BODY_PHOTO="/absolute/path/to/non-personal-body-fixture.jpg" \
  -e E2E_GARMENT_PHOTO="/absolute/path/to/garment-fixture.jpg" \
  .maestro/signup-to-tryon.yaml
```

The operating-system picker layout differs slightly by OS release. The flow selects the two most recently added fixtures by grid position; keep the test simulator gallery empty before a run. Never use a production member account or personal images.
