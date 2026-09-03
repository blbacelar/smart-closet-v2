# Historical TDD Evidence: OpenRouter Try-On Adapter

> Replaced by the direct Gemini adapter on 2026-09-02. See `docs/tdd-evidence/gemini-tryon.md` for the current provider contract.

- Source: owner decision to consolidate image generation through OpenRouter
- Completed: 2026-09-02
- Framework: Jest 29 and jest-expo 54

## User Journey

As a Fitly member, I can send my private body and garment images through the existing Studio flow and receive a generated try-on from OpenRouter without adding FASHN as another paid provider.

## RED

Command:

`npm test -- --runTestsByPath supabase/functions/tryon-enqueue/__tests__/openRouterProvider.test.ts supabase/functions/tryon-enqueue/__tests__/processor.test.ts`

Result: both suites failed before implementation because the OpenRouter adapter did not exist and the processor still required FASHN's create-and-poll contract.

## GREEN Guarantees

| Guarantee | Evidence |
| --- | --- |
| The API key stays server-side | Edge Function configuration and adapter tests |
| The person and garment are sent as two base64 reference images | OpenRouter request contract test |
| Requests use `google/gemini-3.1-flash-image` through pinned `google-vertex/global` routing | Adapter contract test |
| Provider fallbacks are disabled so private images cannot silently route elsewhere | Adapter contract test |
| OpenRouter's returned cost is written to the existing cost ledger | Adapter and processor tests |
| Invalid output and provider details are reduced to safe application failures | Adapter and processor error tests |
| Results are copied into private Supabase Storage | Processor tests |
| Changing the model/provider invalidates deterministic try-on cache entries | `20260903003000_openrouter_tryon_cache.sql` |

## Deployment

The cache migration and `tryon-enqueue` Edge Function are deployed. `OPENROUTER_API_KEY` was validated through OpenRouter's key endpoint and installed as a Supabase Edge Function secret without printing or committing it. No paid image-generation request was made during implementation.

## Original-image MIME regression

The zero-cost garment-preparation fallback stores a JPEG. A focused processor test first demonstrated that the try-on worker incorrectly labeled that JPEG as PNG. The worker now derives the private input data URL MIME type from its server-controlled storage path. The focused suite passes 9 tests, and the full project passes 141 tests with 93.08% statement and 80.97% branch coverage.

## Verification

- 23 test suites and 138 tests passing
- Coverage: 93.18% statements, 81.22% branches, 86.75% functions, 94.17% lines
- TypeScript check: PASS
- Expo web export: PASS
- Expo Doctor: 18/18 checks
- Linked database lint: PASS
- `tryon-enqueue`: ACTIVE, version 3, JWT verification enabled
- Unauthenticated live endpoint smoke test: HTTP 401
