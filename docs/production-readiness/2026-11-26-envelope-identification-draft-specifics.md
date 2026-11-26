# Envelope-led identification and draft-specifics repair

## Observed failure

The supplied screenshots show a saved rapid coin labelled only “Coin 1”, a missing Numista reference message, and a PostgreSQL `22023: Invalid draft specifics` rejection. These are separate problems: identification evidence was hidden until a draft existed, envelope transcription was not reliably returned by the generic scan, and the coin category safety filter removed the specifics property required by the draft RPC.

Read-only source inspection of SWISH main's `supabase/migrations/20261030_specialist_draft_command.sql` confirms `swish_create_listing_draft` requires `p_listing.item_specifics` to be a JSON object, including when empty. Saved item specifics are a separate array and are retained/merged by that RPC. No original-backend SQL or user-data changes were made. The builder database has neither `items` nor `listings`; the existing original SWISH client binding remains unchanged.

## Implemented

- Coin-category safety filtering still discards AI categories, condition IDs and unrelated AI specifics, but emits `item_specifics: {}` rather than deleting the RPC-required property.
- The final quick-capture boundary also repairs missing, null or array-shaped *generated coin* specifics in legacy checkpoints. It does not remove the seller's saved item-specifics array, relax category validation, reset uncertain publication attempts, or invent a price.
- If a saved envelope has no retained transcription, rapid preparation checkpoints one automatic envelope-first reread before draft preparation. It uses the original saved HTTPS envelope and both coin faces, through the same authenticated `swish-identify` endpoint. This avoids relying only on reduced generic scan copies. No new AI provider, backend schema, separate client, draft engine or publishing endpoint was introduced.
- The reread explicitly requests literal handwriting, structured collector fields, uncertainties and contradictions. Empty/generic responses fail visibly rather than being fabricated into successful OCR. The automatic attempt is bounded; an explicit “Read envelope again” action permits a later user-requested retry.
- Returned collector evidence supports wrapped responses, dictionary fields and numeric values. Collector country/date/denomination can guide research; written weight/diameter do not become physical measurements, and handwriting does not become a seller-confirmed Numista number or authenticity claim. Question-mark dates remain uncertain.
- Reread evidence is saved on the exact original item with tenant/module verification and optimistic concurrency. Saved seller fields, original photos, existing listing buyer copy, prices and publication claims are preserved. The item title is only updated when there is no existing draft or uncertain draft attempt and the saved title still matches the original identification.
- Queue cards show checkpoint identification and the saved original obverse even when draft saving fails. Missing Numista numbers are described as optional, not as a failed identification. Mobile card text and price no longer compete in a shrinking single row; an accidental rendered zero from an empty discrepancy array is removed.

## Existing capture recovery

For the screenshot's explicitly rejected draft, use **Check saved draft / resume** on that same coin. This verifies its saved records before re-preparing. If transcription still is not returned, open Identification evidence and use **Read envelope again**, then review the collector-labelled attribution against both faces. Unknown save outcomes and existing publication claims remain protected; nothing is automatically published.

## Regression coverage added/updated

- `coin-draft-empty-specifics.test.mjs`: unsafe AI category removal retains an empty object; legacy missing/null/array generated specifics are repaired before RPC and reopening does not create another draft.
- `collector-envelope-reread.test.mjs`: original-photo request order, wrapped/dictionary fields, numeric transcription fields, uncertainty preservation, no fabricated OCR and seller-scope rejection.
- `collector-envelope-persistence.test.mjs`: same-item evidence retention, saved seller-field and buyer-copy preservation, publication guards and optimistic conflicts.
- `collector-envelope-ui-contract.test.mjs`: queue identity/photo visibility, optional Numista messaging, explicit reread action, bounded automatic reread and existing draft engine.
- Existing rapid-preparation and coin-category routing tests updated for the required specifics object and envelope-led preparation.

These tests were added but not executed in this editor session. There is no shell/test runner available here. Suggested verification: `node --test scripts/test/coin-draft-empty-specifics.test.mjs scripts/test/collector-envelope-*.test.mjs scripts/test/rapid-coin-preparation.test.mjs scripts/test/coin-category-routing.test.mjs`, followed by the project's normal TypeScript/build checks.

## Remaining live verification

Authenticated original-backend calls were not available in Live Preview (network inspection returned no requests). Verify the deployed original `swish-identify` accepts the supported HTTPS image contract, returns literal handwriting from this real envelope, and produces useful collector-led candidates. Confirm recovery reaches the same saved draft without repeating the `22023` rejection. Compare output against both original coin faces, including all apparent date/denomination uncertainty. No successful live identification, eBay publication or backend deployment is claimed.
