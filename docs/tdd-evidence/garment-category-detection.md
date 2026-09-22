# TDD Evidence: Automatic Garment Category Detection

- Source story: GitHub issue #14, automatic category-detection portion
- Feature: Default Gemini category suggestions with a member-controlled manual override
- Completed: 2026-09-21
- Frameworks: Jest 29, React Native Testing Library 14, pgTAP

## User Journeys

1. As a member, I can leave category on **Auto** when adding a garment.
2. As a member, I can still select a supported category myself and avoid an unnecessary AI call.
3. As a member, an automatically processed garment receives exactly one supported Fitly category.
4. As a member, a category I choose while processing is in progress is never overwritten by a late AI result.
5. As the product owner, category-provider costs are recorded atomically with garment completion and provider errors remain safe and retryable.

## RED

Command:

`npm test -- --runTestsByPath supabase/functions/process-garment/__tests__/geminiTaggingProvider.test.ts supabase/functions/process-garment/__tests__/processor.test.ts supabase/migrations/__tests__/garmentCategoryDetectionMigration.test.ts src/features/garments/__tests__/garmentValidation.test.ts src/features/garments/__tests__/GarmentCaptureScreen.test.tsx`

Result: five suites failed because the Gemini adapter and migration did not exist, null category was rejected, the capture screen had no Auto option, and the worker did not classify uncategorized garments. Preserved in commit `8f69989`.

The handler regression was separately observed red when its provider-failure copy still referred only to background removal.

## GREEN

Focused command:

`npm test -- --runTestsByPath supabase/functions/process-garment/__tests__/handler.test.ts supabase/functions/process-garment/__tests__/geminiTaggingProvider.test.ts supabase/functions/process-garment/__tests__/processor.test.ts supabase/migrations/__tests__/garmentCategoryDetectionMigration.test.ts src/features/garments/__tests__/garmentValidation.test.ts src/features/garments/__tests__/GarmentCaptureScreen.test.tsx`

Result: 40 assertions passed across six suites. The implementation is preserved in commit `fa8f1ee`.

Database command:

`npx supabase migration up --local && npx supabase db lint --local --level warning && npm run test:db`

Result: the migration applied cleanly, database lint reported no findings, and all 42 pgTAP assertions passed. The database suite proves nullable category upload, worker claim, member edits during processing, manual-choice preservation, and one cost entry per provider operation.

## Provider and Privacy Contract

- The original private JPEG is sent only from the Edge Function to Gemini.
- Requests use the Gemini Interactions API with `store: false`.
- Structured output restricts the result to `top`, `bottom`, `dress`, `outerwear`, or `shoes`.
- The provider call is skipped when the member already selected a category.
- Retryable 429 and 5xx responses use bounded exponential retry; permanent failures do not retry.
- Provider payloads and secrets are never returned to the app.

## Final Verification

- `npm run typecheck` — PASS
- `npm run test:coverage` — 310 tests PASS; 92.79% statements, 81.03% branches, 87.58% functions, 94.18% lines
- `npm run check:pii` — PASS
- `npx expo-doctor` — 21/21 checks PASS
- `npm run build:web` — PASS
- `npx supabase db lint --local --level warning` — PASS with no findings
- `npm run test:db` — 42 assertions PASS

## Known External Check

A successful paid real-image request still depends on the configured Google project having available credits. The automated suite uses deterministic provider responses and does not spend API credits.

## Merge Evidence

- RED checkpoint: `8f69989 test: define automatic garment category detection`
- GREEN checkpoint: `fa8f1ee feat: detect garment categories with Gemini`
