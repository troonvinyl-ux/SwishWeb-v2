# Coin draft recovery and country/date category matching

## Implemented

- Category relevance now reads nested coin fields, confirmed attributes, native `country_of_origin` / `year_made` columns and camel-case aliases. Search fallbacks retain recorded issuing country and date rather than falling back to an unrelated country or generic coin leaf.
- Single-item versus lot and ancient/Roman/hammered protections remain. Modern Greek coins are not automatically classified as ancient. Ancient mint geography does not select a modern national coin category.
- Date-bounded leaves and incompatible Russian issuing-period branches are rejected. Equally ranked, distinct coin leaves require clarification instead of silently accepting the first candidate.
- Cached invalid preparation is discarded before draft creation. Changing to a category with no aspects clears the previous category's specifics, instead of retaining art fields.
- The draft checkpoint records explicit transactional PostgreSQL rejections separately from ambiguous gateway/network results. Pre-send failures do not create an attempted journal entry.
- The queue and review surface expose **Check saved draft / resume** and a link to the exact original inventory item. Recovery verifies the signed-in module, physical capture identity, stock state and every matching listing. It never creates a draft or publishes to eBay itself.
- A single verified existing draft is linked back to the queue for readback. A confirmed rejected RPC can be retried by explicit user action on the same inventory item. Multiple drafts, marketplace history, pending publication claims, active workers and changed local journals refuse automatic repair.
- Envelope parsing accepts wrapped responses and does not allow an empty compatibility object to hide returned transcription. Retained raw transcription can be displayed for older captures without inventing text or rerunning identification.

## Important limits

An empty listing query is not proof that a request with a lost response rolled back. Legacy uncertain attempts remain protected if no existing draft can be verified; use the original inventory item and backend investigation rather than clearing the journal or creating a second coin. Missing transcription still requires seller review when no actual text was returned or retained.

No authoritative SWISH data was modified through the builder database. The application remains bound to its existing SWISH backend; the builder identity check returned no `items` or `listings` tables. No duplicate schema, alternate AI provider, new publishing route or private credential was introduced.

## Regression commands

```sh
node --test scripts/test/coin-country-date-routing.test.mjs scripts/test/rapid-draft-recovery.test.mjs scripts/test/capture-draft-outcome.test.mjs scripts/test/collector-envelope-response.test.mjs
node --test scripts/test/coin-category-*.test.mjs scripts/test/rapid-coin-recovery-pricing.test.mjs scripts/test/rapid-coin-preparation.test.mjs scripts/test/coin-studio-workflow.test.mjs scripts/test/studio-listing-prefill.test.mjs scripts/test/listing-studio.test.mjs
npx tsc --noEmit -p tsconfig.app.json
npx vite build
```

These tests and build commands were not executed in this editor session. No Live Preview network requests were available. Authenticated seller verification remains pending: check the reported queue entry, recover its exact draft if present, run Find eBay category, compare the full breadcrumb against the actual coin, choose supported condition/specifics and save. Do not claim a listing is live until the existing publication reconciliation verifies its eBay ItemID and stock state.
