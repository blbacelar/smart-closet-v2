# TDD Evidence: OpenRouter Try-On Adapter

- Source: owner decision to consolidate image generation through OpenRouter
- Originally completed: 2026-09-02
- Reactivated: 2026-10-16
- Framework: Jest 29 and jest-expo 54

## User Journey

As a Fitly member, I can send my private body and garment images through the existing Studio flow and receive a generated try-on from OpenRouter without adding FASHN as another paid provider.

## RED

Command:

`npm test -- --runTestsByPath supabase/functions/tryon-enqueue/__tests__/openRouterProvider.test.ts supabase/functions/tryon-enqueue/__tests__/processor.test.ts`

Result on reactivation: the adapter test failed because `openRouterProvider` no longer existed, and the processor test proved that pre-generation failures were still attributed to Gemini.

## GREEN Guarantees

| Guarantee | Evidence |
| --- | --- |
| The API key stays server-side | Edge Function configuration and adapter tests |
| The person and garment are sent as two base64 reference images | OpenRouter request contract test |
| Requests use `google/gemini-3.1-flash-image` through pinned `google-vertex/global` routing | Adapter contract test |
| Provider fallbacks are disabled so private images cannot silently route elsewhere | Adapter contract test |
| Routing denies data collection, requires ZDR, and requires exact parameter support | Adapter contract test |
| Non-private or malformed input references are rejected before any provider request | Adapter validation test |
| OpenRouter's returned cost is written to the existing cost ledger | Adapter and processor tests |
| Ambiguous paid requests are never retried automatically | Adapter failure-contract test |
| Hung requests abort before stale-job reconciliation and preserve conservative cost | Adapter timeout and processor-ledger tests |
| Invalid output and provider details are reduced to safe application failures | Adapter and processor error tests |
| Results are copied into private Supabase Storage | Processor tests |
| Changing the model/provider invalidates deterministic try-on cache entries | `20260903003000_openrouter_tryon_cache.sql` |

## Deployment

The local `OPENROUTER_API_KEY` was validated through OpenRouter's key endpoint without printing it. The live model-capability endpoint confirmed that `google/gemini-3.1-flash-image` accepts up to 14 references through `google-vertex/global`. Deployment requires an account authorized to update the Supabase Edge Function and its secret; local CLI access currently receives HTTP 403 for those administrative endpoints.

## Original-image MIME regression

The zero-cost garment-preparation fallback stores a JPEG. A focused processor test first demonstrated that the try-on worker incorrectly labeled that JPEG as PNG. The worker now derives the private input data URL MIME type from its server-controlled storage path. A later adversarial review found that automatic retries could duplicate paid generations after ambiguous failures, that a missing usage cost could be recorded as zero, and that requests had no real timeout. RED tests reproduced all three risks. The adapter now makes one paid attempt, aborts after 90 seconds, and carries exact or conservative cost metadata through failure accounting.

## Reactivation RED/GREEN checkpoints

- RED commit: `21510e9` — missing adapter module and wrong processor provider attribution.
- GREEN commit: `268b939` — focused adapter/processor suite passed 19/19 tests.

## Reactivation verification

- Focused adapter/processor suite: 22/22 tests passing after the adversarial-review fixes.
- Full project suite: PASS.
- Coverage: 90.93% statements, 81.59% branches, 85.49% functions, and 92.94% lines.
- TypeScript check: PASS.
- PII safety and external-draft hash checks: PASS.
- Expo Doctor: 21/21 checks.
- Expo SDK 57 web export: PASS.
- Critical production dependency gate: PASS; the existing transitive high/moderate advisories remain separately tracked.
- Isolated Supabase upgrade, lint, ledger, RLS, expiry, notification, operational-health, and concurrency suites: PASS.
- The operational-health fixture initially failed because a production trigger replaced its synthetic `updated_at` with wall-clock `now()`. The fixture now reconstructs the intended stale state directly; production SQL was not weakened.
