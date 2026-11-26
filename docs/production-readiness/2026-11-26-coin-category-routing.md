# Coin category relevance repair

## Reported selection

The supplied screenshot shows the original coin draft selected as Art Prints, category 360. The shared web lookup previously accepted the first numeric, leaf category returned by eBay without checking whether it described the physical numismatic object. A portrait-based title could therefore select artwork instead of coins.

## Changes

- The existing category lookup prefixes coin research with the physical object type. It rejects art, prints, photographs, supplies, unrelated roots and wrong numismatic object types even when those results are ranked first.
- Country/period leaves such as Italy or Roman require a returned Coins ancestry. No static replacement ID, British country default, ruler, date or catalogue attribution is invented.
- Bounded fallback uses a numismatic object query through the same existing eBay services. Authentication failures and changed scopes remain fail-closed. Other niches retain their existing selection rules.
- Actual returned Coins ancestry travels through scan enrichment, draft review and existing item JSON metadata; no schema or backend binding changes.
- The existing editor warns about the saved Art Prints category and does not load its art-specific requirements. Find eBay category selects a relevant live leaf, clears the previous condition ID and category-specific fields, and preserves title, description, price, defects and photos.
- Submission rejects an invalid numismatic category before starting a rapid publication attempt. Accepted ItemIDs, server claims and reconciliation safeguards are unchanged.
- AI-generated coin copy cannot independently supply a category ID, category condition or art-specific fields. Live taxonomy enrichment supplies those afterwards; an unavailable lookup leaves an editable draft requiring category selection.

## Seller recovery

Reopen the affected draft, open Listing specifics, press Find eBay category, check the returned Coins branch, choose its supported condition and complete its factual specifics, then save. This changes the same intended listing; it does not create another inventory record or republish an uncertain attempt.

## Verification

Added coin-category-routing.test.mjs and coin-category-editor.test.mjs; updated category/scoped-lookup test loading and the existing editor-hook contract. Cases cover the reported Art Prints result, bounded fallback, country/ancient/hammered leaves, wrong objects, blank/invalid IDs, auth/scope failures, preserved seller copy, cleared art requirements and unaffected music/art workflows.

No shell/test execution tool is available here. The regression suite, TypeScript build and authenticated seller/eBay category repair are not claimed as executed or verified. Run before release:

```
node --test scripts/test/coin-category-*.test.mjs scripts/test/category-lookup.test.mjs scripts/test/scoped-category.test.mjs
npx tsc --noEmit -p tsconfig.app.json
npm run build
```

This builder Cloud is not the original SWISH seller database. No seller records were changed with SQL, no taxonomy ID was treated as live without an actual service response, and no live eBay publish was performed.
