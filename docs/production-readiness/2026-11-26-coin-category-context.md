# Single-coin and ancient-coin category repair — 26 November 2026

## Report
The seller's single Roman Imperial coin was assigned Collections/Bulk Lots (3410), despite displaying one item. The previous relevance check excluded Art Prints but accepted any eligible Coins ancestry; its generic `collectible coins` fallback could also lose the ancient/Roman context.

## Changes
- Single physical coins reject bulk/lot/collection/set categories, including the reported bulk-category ID even if its local label is misleading.
- Explicit seller lot declarations or a title describing multiple coins sold together can request lot categories. Stock quantity, batch size, collector's envelopes and notes about a collection do not imply a lot.
- Both primary and fallback queries retain ancient, Roman/Greek/Byzantine or hammered/modern context supported by draft and item fields. Search-only boilerplate such as `Provisional:` is omitted; listing copy remains unchanged.
- Relevant leaf results are filtered and ranked: a matching Roman branch beats a generic ancient leaf when both appear in the live response. No correct category IDs are hard-coded or inferred from AI.
- Existing saved drafts are checked against the same context in the editor and before save/publish. The shared UI shows an inline replacement warning and suppresses obsolete category metadata.
- Reopening a draft binds category labels and paths to their matching category ID, rather than displaying stale stock metadata against a different authoritative ID.
- Replacement still clears old category-specific condition and specifics, preserving seller title, description, defects, price and stock identity. Nothing publishes automatically.

## Backend boundaries
The existing SWISH client remains bound to its original backend. The current builder Cloud has no SWISH `items`/`listings` tables; no schemas or seller records were changed here. Existing module authorization, live leaf checks, seller isolation, publication claims and accepted ItemID recovery are unchanged. This is a web repair; the native repository and deployed SWISH worker were not modified.

## Regression coverage
Added `coin-category-context.test.mjs` and `coin-category-reopen.test.mjs`. Expanded pre-publication coverage for the reported bulk-lot category and ancient coins incorrectly routed to modern-country leaves. Updated lookup fixtures/dependencies and editor syntax coverage.

Execution is unverified: this session has no command runner. Production network logs were unavailable in Live Preview, and this builder cannot access the original SWISH category worker logs. No test-passed or deployed-seller-verification claim is made.

## Seller verification
1. Open the affected original draft and choose Find eBay category.
2. Check the returned live ancient/Roman branch and the actual coin attribution; taxonomy routing is not an authenticity certificate.
3. Select the new category's supported condition and complete its required specifics, then save this same draft.
4. Verify that reopening preserves the category ID/path and that the original photos, title, price, stock ID and publication journal remain intact.
5. If live taxonomy returns only inappropriate categories, leave the draft editable without choosing a bulk/modern fallback. No duplicate inventory or eBay listing should be created.
