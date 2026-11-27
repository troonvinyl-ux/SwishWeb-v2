# Physical coin categories versus Publications — 2026-11-27

## Report and confirmed code defect

The seller reports successfully published coins appearing in `Coins > Coins > Publications`. The web relevance policy accepted any otherwise-unexcluded leaf below a Coins root. Publications, literature, catalogues and guides were missing from that exclusion. Consequently a real, valid eBay leaf for reference material could pass category selection, saved-category reuse, editor save and publish guards. Leaf validity alone is not physical-object relevance.

No authorised seller session or production request trace was available. Live Preview returned no network requests. The builder database contains neither `items` nor `listings`; no schema or data was changed there. The authoritative existing SWISH client and backend binding are unchanged. This code defect is confirmed; production server-side category substitution or remapping has not been ruled out.

## Implementation

- `coinCategoryExclusion.ts`: shared semantic exclusion for Publications, literature, catalogues, price/reference guides, magazines and supplies/equipment. Checks category names and full ancestry, never titles, collector notes or catalogue-reference evidence. No Publications ID is guessed or hard-coded.
- The relevance policy and mismatch guard share this exclusion. Physical coins, banknotes, medals, tokens and lots cannot use reference-material branches. Book workflows outside the numismatic specialist are unaffected.
- Normal and rapid category selection retain the same SWISH title/country suggestion route and live leaf proof. A rejected top-ranked Publications result does not end the search when a physical-coin leaf is present. A saved Publications selection is no longer reused.
- The category version was bumped. Clean affected drafts become eligible for the existing automatic preselection attempt; seller edits and accepted publication claims remain protected.
- Unsaved rapid preparation rejects obsolete Publications checkpoints. Retained machine-generated category, condition and specifics fields are stripped again before merging current enrichment, so a failed replacement lookup cannot leak the old Publications ID through `p_listing` while `p_category_id` is null. It keeps the same item, title and description and does not rerun identification/generation or recreate an existing saved draft.
- `verifyListingCategory.ts`: read-only verification through the existing `get_category_aspects` route with `forceLive: true`. Requires matching selected category ID, EBAY_GB and affirmative leaf proof. Uses service-returned category labels/ancestry when available instead of stale local labels. Retryable category failures are distinguished from fatal authentication/workspace errors.
- Publication verifies the coin category before any rapid journal or publish call. After preparation, the saved category must still exactly match the verified ID. No server/category fallback substitution is allowed in the client publish payload. Concurrent claims or editor changes stop the request.
- Editor save also checks the resolved category after legacy fallback resolution, preventing partially hydrated forms from reintroducing Publications.

## Verification status

Added regression files:

- `coin-publications-category.test.mjs`: exclusion, top-ranked wrong leaf, India fallback, saved draft repair, authoritative metadata overriding a misleading label, exact-ID/marketplace validation, auth/workspace safety, and unaffected book listings.
- `coin-publications-submission.test.mjs`: blocking before saves/journals/publish, live metadata rejection, valid native publication path, concurrent category/claim/edit changes, accepted-claim protection.
- `coin-publications-checkpoint.test.mjs`: same-item preparation repair, no stale category in generated RPC data after failed lookup, and no recreation of a saved draft.

Updated the existing coin publish and syntax tests, and supplied the editor revision reference in the direct-submission fixture.

Tests were added but **not executed**: no terminal/test runner is available in this editing session. Existing GitHub CI runs `scripts/test/*.test.mjs`, typecheck and build.

```sh
node --test scripts/test/coin-publications-*.test.mjs scripts/test/coin-category-publish.test.mjs scripts/test/direct-ebay-submission.test.mjs scripts/test/shared-category-syntax.test.mjs scripts/test/british-india-category.test.mjs scripts/test/shared-listing-category-path.test.mjs scripts/test/scoped-category.test.mjs
npx tsc --noEmit -p tsconfig.app.json
npm run build
```

## Production acceptance and existing live items

1. Publish the web changes and reopen the same affected draft in the seller's coins workspace. A clean draft can preselect a replacement; dirty edits are not overwritten.
2. Check the returned physical-coin category and full path, choose its supported condition, save and reload. Confirm the same category ID is retained.
3. On one explicitly approved unpublished coin, inspect the live requirements response and outbound `swish-ebay-list` publish category ID, then compare the resulting eBay listing category. If eBay still shows Publications despite a different verified outgoing ID, investigate the authoritative SWISH publisher's category resolution/remapping; no production backend patch is claimed here.
4. Already-live listings and accepted ItemIDs are untouched. Correct them by revising the existing eBay listings, not creating duplicates or resubmitting their original drafts. Automatic live revision was neither requested nor implemented.

Limits: if the SWISH aspects service omits category labels/ancestry, semantic verification uses the retained selection alongside the service's exact-ID and live leaf/marketplace proof, matching the existing native contract. A backend-only override cannot be proven absent from this editor without the production response and eBay readback.
