# SDK 57 development-build and two-account harness evidence

Date: 2026-10-15

Roadmap slice: C02

GitHub authority: #34

## User journeys

1. As a contributor without Apple signing credentials, I can install and run an Expo SDK 57 development build in the iOS simulator.
2. As a tester, I can create or refresh deterministic seller and buyer accounts without placing test credentials in production code.
3. As a seller, I can sign in, see the seeded marketplace garment, and verify the 100-credit seller balance.
4. As a buyer, I can sign in after the seller, see the same private-bucket listing image, and verify the 500-credit buyer balance.
5. As a maintainer, I cannot accidentally run the service-role seed against a remote target unless I explicitly opt into the staging-only guard.

## RED checkpoints

- `3db9813 test: require seeded development device harness`
  - The repository had no SDK 57 development-client dependency, runtime policy, simulator build profile, guarded two-account seed, or installed-build Maestro contract.
- Executable pgTAP regression, 2026-10-15:
  - An authenticated buyer could not select the Storage object backing another member's active listing.
  - This reproduced the device failure where marketplace discovery returned data but `createSignedUrl` rejected the listing image.

## GREEN checkpoints

- `d73fca9 feat: add seeded SDK 57 device harness`
  - Added the SDK 57 development client, runtime version policy, internal development/simulator/staging profiles, guarded seed script, service-role seed grants, synthetic fixture, and two-account Maestro flow.
- Marketplace image access repair:
  - Added a narrowly scoped, authenticated, `auth.uid()`-bound server decision for listed garment objects.
  - Publishes only the effective cleaned path; the original upload, private closet, and body-photo objects remain owner-only.
  - Added executable buyer-vs-seller pgTAP coverage and a migration contract.
- Seed safety repair:
  - Requires an exact remote staging project-ref match and a reserved synthetic email namespace.
  - Refuses to take over an unmarked account or overwrite fixture state after marketplace activity.
  - Creates idempotent adjustment-ledger rows matching the synthetic 100/500 balances.
- Accessibility/runtime hardening:
  - Exposed exact Fitly Credit balances to assistive technology so the installed test distinguishes both identities.
  - Updated the flow for the numeric date-of-birth field, native password prompt, and actual tab accessibility labels.

## Verification

| Guarantee | Evidence | Result |
| --- | --- | --- |
| Expo dependency set matches SDK 57 | `npx expo install expo-dev-client`; Expo Doctor 21/21 | PASS |
| Native build is installable without an Apple Developer account | `npx expo run:ios --device E3085242-0BB8-44C6-AF8A-8697B18505A4`; iPhone 17 Pro, iOS 26.5 simulator | PASS |
| EAS profiles resolve | `eas config` for iOS development-simulator and Android staging | PASS |
| Local seed is idempotent | `npm run e2e:seed` twice; stable account and listing identifiers | PASS |
| Seller fixture is correct | authenticated API check: 100 credits and one active listing | PASS |
| Buyer fixture is correct | authenticated API check: 500 credits and the seller's active listing | PASS |
| Listing images are buyer-readable without opening private closets | pgTAP 58/58: active cleaned path allowed; original, unlisted, and withdrawn paths denied | PASS |
| Installed two-account journey works | Maestro: seller login/100 credits/listing → logout → buyer login/500 credits/same listing | PASS |
| Harness and migration contracts are enforced | targeted Jest suites: 17/17 | PASS |

## External boundary

The owner does not yet have Apple Developer credentials. This slice therefore
proves the native path with an installed iOS simulator development build. A
signed physical-device build remains an explicit Gate D/C24 release task; it is
not represented as completed here. Production Gemini and storefront credentials
are also outside this harness slice.
