# Coin identification field population — 17 November 2026

## Observed code issue

The coin scanner expected legacy flat candidate properties. The native identification contract returns canonicalTitle, coinFields, attributesConfirmed, attributesInferred, observedCharacteristics, evidenceSupporting, evidenceContradictory and missingInformation. These structured details were not consistently displayed or mapped to canonical inventory columns.

The web item-detail Re-ID action explicitly wrote only canonical_title. The inventory editor had a second title-only action. This could leave the title correct while supported issuer, denomination, period, mint, material, description and other details remained absent.

## Frontend correction

- Shared response normalization covers native, direct, wrapped and legacy ranked responses. Explicit failed/unidentifiable responses never become candidates.
- Coin fields, confirmed/inferred attributes, observed faces and legends are displayed as reviewable returned information. The title is not parsed to invent a denomination, issuer, date or mint.
- Initial scan confirmation and reviewed Re-ID map supported identity fields to the existing canonical items columns and preserve the structured candidate in attributes.source_scan.confirmed_candidate.
- The item overview reads nested saved details when canonical columns are blank. Empty strings no longer mask meaningful saved values.
- Re-ID saves only after the user chooses Apply reviewed details, retaining existing user/tenant/niche checks and updated_at compare-and-swap protection. Unknown fields never erase known details.
- Actual measurements, original photographs, studio associations, inventory location, financial columns and eBay listings are not changed by the Re-ID patch. AI catalogue/estimated measurements are not promoted to actual measured columns.
- The editor routes to the shared Re-ID review instead of maintaining a second title-only implementation.

## Existing saved stater

Reopen its inventory overview to display any structured fields already retained in its source scan. If the previous title-only action discarded those details, use Re-ID from original photos, review the new output and choose Apply reviewed details. If the service supplies only a broad identity such as stater, issuer/date/mint remain unknown; weight, diameter, clearer legends or a catalogue reference may be needed. No unsupported attribution has been filled in.

## Verification status

No live network requests were available during this session, so the specific latest scan response and saved record could not be inspected or repaired directly. No backend resources, schemas, credentials or services were created or changed.

Regression coverage: scripts/test/identification-details.test.mjs covers structured fields, legacy/wrapped responses, explicit failures, title-only unknowns, protected measurements/prices/photos, saved nested fields and version/scope guards. The available editor tools cannot execute the test suite, so these checks and real-account verification remain unrun.

Run in the existing repository CI or local development environment:

```sh
node --test scripts/test/identification-details.test.mjs scripts/test/item-detail-studio.test.mjs scripts/test/camera-zoom.test.mjs scripts/test/import-integrity.test.mjs
```

Confirm on the signed-in account that the reviewed details populate the stater inventory overview without altering any current live eBay listing or seller-recorded measurements.
