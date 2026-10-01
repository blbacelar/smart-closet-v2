# Legal and privacy guardrails — TDD evidence

## Red

Tests were added first for adult eligibility boundaries, server migration
requirements, consent-gated observability, absence of replay/remote-font
dependencies, mandatory marketing-email footers, subscription renewal copy,
and copyright-report construction.

## Green

Implementation added the matching UI, authentication metadata/RPC flow, RLS
upload checks, no-consent telemetry boundary, compliant email builder, honest
beta subscription state, and configurable copyright-report screen.

## Verification

Run:

```sh
npm test -- --runInBand
npm run typecheck
npm run check:pii
npx expo export --platform web
```

Database migration:

```sh
npx supabase db push
```
