# British India category selection repair — 2026-11-27

## Verified code defects

- Country matching required one country word. `British India` matched Britain and India, making category-search geography null. This weakened the fallback to `collectible coins` despite retained country evidence.
- Breadcrumbs such as `Coins > British > Indian` were likewise treated as conflicting countries instead of using the specific Indian child.
- The editor's Find eBay category action ignored typed category text, and the shared coin lookup forced the original title even when given a different query.
- A bare recorded year such as 1204 could be compared directly with Gregorian category date ranges despite a British-India attribution and an unverified calendar.
- The last empty fallback could hide an earlier actual service error.

## Changes

- `coinCategoryCountry.ts` maps British India to India for search/relevance only. The original issuer stays British India in attribution and listing specifics. The most specific named country in a breadcrumb takes priority over a colonial parent. Other conflicting country labels remain unresolved.
- `coinCategoryDate.ts` separates taxonomy-compatible dates from recorded dates. Explicit non-Gregorian dates and a bare pre-1600 date attached to British India are not used to exclude Gregorian category ranges. No conversion is invented. Explicit CE/Gregorian dates retain range checks; an explicitly supplied Gregorian year can be used separately.
- `coinCategorySearches.ts` supplies at most two query leads to the same existing SWISH service: the actual title or explicit search text, then known issuing geography. For British India the geographic fallback is `India coins`. A typed Indian label becomes `Indian coins`.
- `lookupScopedListingCategory` accepts an optional query separately from the actual item title. A manual query does not reuse an older saved category ahead of that search. Module verification remains before dispatch and after readback.
- `useListingCategorySuggestion` passes typed category text when there is no selected ID. Automatic preselection retains the normal title path. Existing title, description, price and retained identity specifics are not replaced.
- Updated lookup version allows stale unsaved preparation failures to use the repair on the same item. The automatic editor attempt is also version-keyed. No item/draft creation or publication is added.
- Earlier shared-service failures are retained in the final error; diagnostics report received and relevant-leaf counts without logging credentials or authorization data.

## Architecture and safeguards

The normal web listing flow and rapid coin flow still use `swish-ebay-category` with the existing `swish-ebay-list` compatibility fallback. No private tree resolver, fixed Indian category ID, new backend schema or AI provider request is introduced. Leaf status and IDs still come from the shared service. Wrong-country, art, supplies, bulk-lot, incompatible ancient-tradition, authentication and stale-scope checks remain. Selected categories continue into the existing live aspects/condition-policy workflow and explicit seller save.

The editor's Cloud identity check returned no `items` or `listings` tables. The authoritative SWISH binding is retained; the builder Cloud was not modified. Live Preview supplied no network requests to inspect.

## Added regression coverage — not executed in this session

- `british-india-category.test.mjs`: original issuer/date retention, India fallback, Indian manual query, name-only leaves, colonial breadcrumbs, non-Gregorian date handling, explicit CE ranges, saved editor guard, unrelated categories, upstream errors and read-only architecture.
- `coin-category-manual-search.test.mjs`: editor query forwarding, selected ID and identity-specific retention, automatic title lookup and existing publish-claim protection.
- `coin-category-autoselect.test.mjs`: one automatic attempt for a clean British India draft without a Numista reference.
- `shared-category-syntax.test.mjs`: includes all new helpers and affected hooks.

Suggested verification command:

```sh
node --test scripts/test/british-india-category.test.mjs scripts/test/coin-category-manual-search.test.mjs scripts/test/coin-category-autoselect.test.mjs scripts/test/shared-category-syntax.test.mjs scripts/test/category-lookup.test.mjs scripts/test/coin-country-date-routing.test.mjs scripts/test/shared-listing-category-path.test.mjs scripts/test/scoped-category.test.mjs
```

## Live acceptance still required

After publishing the web changes, reopen the same British India draft in the seller's existing coins workspace. A clean unresolved draft should preselect a service-returned Indian leaf, then load its live aspects and conditions. If there are unsaved edits, use Find eBay category; typed Indian text is now honoured. Confirm the original issuer and date remain unchanged, select a supported condition, save, and reload to verify the same category ID is retained. Do not recreate or republish an item for this check. A browser session with the seller's authoritative SWISH/eBay authorization was not available here, so successful production lookup is not claimed.
