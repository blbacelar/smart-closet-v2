# TDD Evidence: Direct Gemini Try-On Adapter

- Source: owner decision to call Google Gemini directly
- Completed: 2026-09-02
- Framework: Jest 29 and jest-expo 54

## User Journey

As a Fitly member, I can send my private body and garment images through the existing Studio flow and receive a generated try-on directly from Gemini without routing those images through OpenRouter.

## RED

Command:

`npm test -- --runTestsByPath supabase/functions/tryon-enqueue/__tests__/geminiProvider.test.ts`

Result: the suite failed because the direct Gemini adapter did not exist.

The processor suite then failed because provider failures were still attributed to OpenRouter.

## GREEN Guarantees

| Guarantee | Evidence |
| --- | --- |
| The Google key stays server-side | Edge Function configuration and adapter tests |
| Person and garment are sent as separate inline images with their real MIME types | Provider and processor tests |
| Requests use Google's `gemini-3.1-flash-image` Interactions endpoint directly | Provider contract test |
| `store: false` prevents interaction-history retention | Provider contract test |
| Output requests use a 2:3, 1K JPEG format | Provider contract test |
| Transient failures retry with bounded backoff; permanent failures do not | Provider error tests |
| Invalid input/output and provider details become safe application failures | Provider and processor tests |
| Results remain in owner-private Supabase Storage | Processor tests |
| The Gemini model namespace invalidates previous provider cache entries | Edge Function configuration |

## Cost Accounting

The Gemini Interactions response reports tokens rather than a dollar total. Fitly records the server-configurable `GOOGLE_GEMINI_TRYON_COST_USD_FALLBACK`, defaulting to `$0.07` for the current 1K model configuration. This is an operational estimate and should be updated when the configured model or Google pricing changes.

## Security

`GOOGLE_GEMINI_API_KEY` is read only by the Supabase Edge Function. Requests are authenticated by the user's Supabase JWT, inputs come from server-controlled private Storage paths, output payloads are base64-validated, and Gemini interaction storage is explicitly disabled.

## Deployment and Verification

- `GOOGLE_GEMINI_API_KEY` validated against Google's model endpoint and installed as a Supabase Edge Function secret without printing or committing it.
- The unused OpenRouter key was removed from Supabase secrets; the user's ignored local copy was preserved.
- `tryon-enqueue`: ACTIVE version 8 with JWT verification enabled.
- Unauthenticated live endpoint smoke test: HTTP 401.
- 23 suites and 141 tests passing.
- Coverage: 92.97% statements, 80.91% branches, 87.82% functions, and 93.90% lines.
- TypeScript check: PASS.
- Expo web export: PASS; neither provider key appears in the bundle.
- Expo Doctor: 18/18 checks passed.
