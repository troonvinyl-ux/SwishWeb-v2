# Coin category live leaf-proof repair — 2026-11-27

## Observed report and code defects

The seller reports a category-free coin draft with “No matching eBay coin category was returned by the shared listing service.” Live Preview returned no network requests, so the seller's exact production payload is not available in this session.

The web lookup filtered out every suggestion lacking `isLeaf === true` before attempting live requirements. The transport adapter also omitted `isLeafCategory`, `is_leaf_category` and `LeafCategory`. Consequently a usable service-returned category could be discarded rather than verified. The prior verifier accepted only camel-case, fully echoed marketplace/category IDs. Editor and capture metadata likewise read direct response members instead of wrapped service responses.

## Implementation

- Normalize supported native leaf flags, retaining explicit false over conflicting positive aliases. Normalize snake-case live labels and IDs. Reject conflicting IDs, foreign marketplaces and negative validation members in the live readback.
- Keep explicitly verified suggestions on the existing fast path. For relevant candidates without a flag, call the existing `swish-ebay-category` / `get_category_aspects` route with the exact returned ID and `forceLive: true`. Never infer leaf validity from the title, country or suggestion ranking.
- Bound this additional proof step to three distinct candidate IDs across the existing title/country retries. Failed live checks are remembered during the lookup; compatibility suggestions cannot revive them.
- Accept affirmative normalized leaf metadata or a successful aspects array, including an empty array. The existing native route is fixed to EBAY_GB and the requested category ID. Older revisions need not echo these fields; any explicit conflicting value is rejected. A generic success acknowledgement without leaf/aspects evidence remains insufficient.
- Continue rejecting Publications/reference material, accessories, artwork, wrong-country/date/era branches and single-coin bulk-lot categories. Live labels/ancestry override local labels, including misleading country labels for Publications.
- Editor and capture requirements read wrapped category aspects and condition policies consistently. Source-labelled attribution, original date, photos, seller edits and the existing listing identity are retained.
- Increment the lookup version so old unresolved preparation checkpoints and clean reopened drafts can use this repair. No automatic save, submission, second identification or new draft is introduced by category selection.

## Authoritative source and backend binding

Reviewed `troonvinyl-ux/SWISH` main at `08e0eb7c04590e64ef00837b228316f1b1c5a1a5`, including the category-service contract comments and native listing service. The category service documents live aspects as secondary leaf evidence and supports valid categories with zero aspects. Its route is fixed to EBAY_GB. The complete route implementation was not available in the truncated web retrieval; no claim is made about the seller's live response.

Read-only builder Cloud check found no `public.items` or `public.listings`. The authoritative SWISH backend binding was not changed. No duplicate schema, new provider, backend secret, fixed listing-category ID or private tree resolver was added. Existing accepted-item and publish-claim protection remains in place. Existing live eBay listings are untouched.

## Regression coverage — added, not executed here

- `coin-category-leaf-proof.test.mjs`: native aliases, conflicting flags, raw suggestions, wrapped requirements, zero-aspect leaves, wrong IDs/marketplaces, hidden Publications, bounded retry deduplication, authorization and stale editor scope.
- `category-metadata-transport.test.mjs`: wrapped editor aspects/conditions, explicit non-leaf handling and capture prefill/persistence on the same inventory item.
- `coin-taxonomy-transport.test.mjs`: missing flags now require positive live requirements instead of immediate rejection.
- `shared-category-syntax.test.mjs`: includes the transport and selection helper.

Verification commands:

```sh
node --test scripts/test/coin-category-leaf-proof.test.mjs scripts/test/category-metadata-transport.test.mjs scripts/test/coin-taxonomy-transport.test.mjs scripts/test/coin-publications-category.test.mjs scripts/test/coin-publications-submission.test.mjs scripts/test/shared-category-syntax.test.mjs
npx tsc --noEmit -p tsconfig.app.json
npm run build
```

A command-execution tool and authenticated seller browser session were unavailable, so tests, typecheck, build and live acceptance are not claimed. After deployment, reopen the same unresolved draft and confirm the selected category, live condition policy, saved category ID and original attribution. Do not create or republish a listing merely to verify category lookup.
