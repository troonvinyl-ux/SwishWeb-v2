# Restore the existing SWISH listing category path

## Source-of-truth review

Reviewed the main branch through the public GitHub source during this change:

- `SWISH/services/quickListService.ts`: `quickRequirements` uses a supplied category selection when present; otherwise it sends the item's title, bounded to 100 characters, to `swish-ebay-category` with `route: get_category_suggestions`. It uses a real leaf returned by that service. Requirements come from `get_category_aspects` with `forceLive: true`, and `swish-ebay-list/get_condition_policies`.
- `SWISH/services/preparedListingService.ts`: saved-stock preparation opens an existing draft rather than regenerating it; saved `ebay_category_id`/`ebay_category_name` feed the same requirements path.
- `SWISH/services/listingEditorService.ts`: the editor uses the existing category and listing operations and canonical save RPC.
- `SWISH/services/listingService.ts`: `generateListing` calls `swish-list-generate`; `saveListing` uses `swish_create_listing_draft`. Generated AI category IDs are not independently authoritative.
- Web `ListingNew.tsx` and `NicheCapture.tsx`: category lookup already goes through `lookupScopedListingCategory`; the niche preparation uses the existing generator and canonical RPC.

Exact reference URLs:

- https://raw.githubusercontent.com/troonvinyl-ux/SWISH/main/services/quickListService.ts
- https://raw.githubusercontent.com/troonvinyl-ux/SWISH/main/services/preparedListingService.ts
- https://raw.githubusercontent.com/troonvinyl-ux/SWISH/main/services/listingEditorService.ts

The inspected `quickRequirements` implementation was visible in the retrieved source. Large remote files were truncated by the retrieval tool; this is not a claim to have audited their entire contents or deployed backend behavior.

## Divergence and correction

The web coin lookup previously branched into a separate resolver, expanded evidence into multiple era/date searches, and attempted a private root-tree traversal. Its relevance check also treated absent country/style words as contradictions. That could reject a valid category returned by the normal listing service.

Now:

1. `categoryLookup.ts` is the common category path for normal listings, generic capture and rapid coin preparation. Coins search their actual title through the same existing service. A single bounded country/object retry uses that same suggestion route if necessary; there is no private root walker or extra category classification engine.
2. Saved selections from the existing item attributes are reused only after live `get_category_aspects` confirms the same ID, EBAY_GB marketplace and leaf status. Authorization failures stop immediately.
3. A service-returned country leaf such as Hungary can be selected without an additional ancestry request. Missing leaf proof is not fabricated. A broader genuine coin leaf may be selected when it does not contradict the known identity; country-specific and in-range candidates rank higher, with eBay ordering retained on ties.
4. Art, single-coin/bulk-lot mismatches, explicit wrong-country branches and incompatible ancient periods remain rejected.
5. Both capture enrichment and the existing editor request live category aspects. Conditions still use `swish-ebay-list`; identity, catalogue, seller review and publication remain separate.
6. The saved-coin draft entry no longer deliberately writes a null category after preparation: the same enrichment and canonical RPC carry the service-selected category ID.
7. Old *unsaved* category-error checkpoints can retry the new shared requirements path once, preserving their copy, item ID and originals. Saved drafts, accepted ItemIDs and uncertain draft-save outcomes are not replayed.

The original SWISH client singleton and backend binding are unchanged. No schemas, providers, credentials, user records or main-app repository files were changed directly by this session. The builder Cloud identity check returned no `items` or `listings`; it is not the authoritative SWISH seller database.

## Verification status

Regression coverage added/updated for shared title dispatch, existing-category reuse, localized leaf labels, wider coin categories, country/period contradictions, eBay ordering, same-item checkpoint recovery and draft category persistence.

No shell/test execution tool or authenticated production eBay session is available here. These tests were **not run**; live category lookup, save/readback and publishing are **not verified** by this change.

Suggested checks in the repository environment:

```sh
node --test scripts/test/*category*.test.mjs scripts/test/coin-taxonomy-transport.test.mjs scripts/test/coin-draft-gate.test.mjs scripts/test/coin-draft-empty-specifics.test.mjs scripts/test/studio-listing-prefill.test.mjs
npx tsc --noEmit -p tsconfig.app.json
```

For authenticated acceptance, reopen the same Hungary 1673 draft, check the actual title-suggestion response and selected category, inspect current aspects and condition policies, then save and verify the same listing/item readback. Do not publish as part of a diagnostic test. No exact production category ID has been hard-coded from the supplied photographs.
