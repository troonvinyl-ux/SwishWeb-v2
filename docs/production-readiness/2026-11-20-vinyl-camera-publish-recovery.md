# Vinyl camera and web eBay handoff repair

## Changes
- Vinyl photo capture uses a square guide at 90% of the contained preview's shorter side. Camera/zoom options are collapsed by default so the live picture, not settings, takes most of the phone screen. The guide does not crop the original photo. Barcode and coin guides remain separate.
- The web editor uses the native `swish_save_listing_editor` RPC with `p_listing_patch`, `p_item_patch` and `p_specifics`. Condition, notes, quantity, SKU, photo order and listing options no longer disappear as unsaved web-only controls. New uploads are attached to the same item archive without deleting original photos.
- The large editor is separated into focused UI and workflow files. Saving/refetching reconstructs UI fields from shared inventory attributes; unsaved edits are not overwritten by background readback.
- Verification reads top-level and nested native verdicts. AI warnings remain advisory. Seller review requires an explicit attestation and written inspection notes, sent through the existing authenticated `swish-verify` `human_override` / `override_notes` contract. Blocking failures and marketplace requirements are not locally bypassed.
- Music-specific grade changes update only labelled SWISH condition/playback lines in the draft. Unstructured seller claims and complete catalogue tracks are retained for review. No playback equipment or audio quality is invented.
- Publication still calls `swish-ebay-list` once after explicit confirmation. An eBay success without a returned listing ID is treated as uncertain rather than permission to retry.
- Browser reservations now distinguish an explicit server rejection from a pending/uncertain/accepted result. Only a confirmed rejection plus fresh correctly scoped readback showing an explicit null server claim, no eBay ID and a non-submitted state releases the browser guard. There are no timer resets or automatic resubmissions. Legacy timestamp-only reservations remain uncertain.
- Existing IDs use the native status-only `swish-ebay-listing-status` endpoint. Recovery never publishes or clears server claims. In-app publication can therefore be inspected from the web without creating another listing.

## Source contracts inspected
- `troonvinyl-ux/SWISH/main/services/listingEditorService.ts`
- `troonvinyl-ux/SWISH/58f8cbab498f7af3c678ee9b4689e873f3795244/services/listingEditorService.ts` (complete baseline RPC signature)
- `troonvinyl-ux/SWISH/fd1ee44dd1ecb21bb54e430449a5a1e1c4bbd4c4/services/listingEditorService.ts` (saved media/options contract)
- `troonvinyl-ux/SWISH/main/services/listingPublicationService.ts`
- `troonvinyl-ux/SWISH/main/supabase/functions/swish-verify/index.ts`
- `troonvinyl-ux/SWISH/main/supabase/functions/_shared/listingConfidencePolicy.ts`

## Backend boundary
The existing client stays bound to `https://iwgaqieyoahmcjfziwga.backend.onspace.ai`. No new schema, credentials, backend client or alternate publishing service was created. This editor's platform Cloud tools point to a different project backend and cannot verify the shared production seller account. Live Preview supplied no failed network requests during inspection.

## Verification status
Added deterministic regression tests for editor RPC payloads, blocking validation, advisory-only verification, grade-line synchronisation, record framing and guarded retry eligibility. The existing CI workflow picks up `scripts/test/*.test.mjs` and runs typecheck/build/lint. These commands were not run in this tool session; passing CI and real-device results are not asserted.

Required live acceptance: publish the changed website, capture a 12-inch cover on iPhone/Android, create and reopen a Tunes draft, change grades/condition, verify, optionally record an honest seller review, and explicitly submit using the existing eBay seller policies. Check one accepted listing ID in both SWISH clients and eBay. Also exercise a definitive rejection and a lost response; neither may produce a duplicate. Old uncertain reservations require marketplace inspection, not an unverified reset.
