# eBay draft-to-live and music field repair — 21 November 2026

## Implemented
- An explicit submit saves the existing draft first, including unchanged legacy drafts whose grading values require normalization, then calls `swish-ebay-list` with route `publish`, the saved category ID and condition ID.
- Unpublished `verified`, `review` and `review_required` states are restored to `draft` only on explicit submission and only without a claim or external listing ID. Server-owned claims, account permissions and duplicate protections remain unchanged.
- Category and item condition retain their IDs and display labels. Confirmed item/listing versions prevent a slower, older readback from replacing saved selections.
- Music edits now belong to the same parent draft rather than a separate stock mutation. Save draft and Submit to eBay save music specifics, category, condition, notes, photos and listing options through the existing editor RPC and existing metadata compatibility path.
- Grade text uses eBay vocabulary: Mint (M), Near Mint (NM or M-), Excellent (EX), Very Good Plus (VG+), Very Good (VG), Good Plus (G+), Good (G), Fair (F), Worn (W). Goldmine Poor (P) remains seller evidence and is represented as Worn (W) in eBay specifics, with this mapping disclosed in the editor.
- Vinyl uses Record Grading / Sleeve Grading; CDs use CD Grading / Case Condition; cassettes use Cassette Condition / Case Condition. Other seller specifics and tracklisting are preserved. Inlay grades are not invented from sleeve grades.
- Live localized aspect values are read from the same `swish-ebay-category` / `get_category_aspects` contract used by the native editor. Lookup failures retain saved selections rather than blocking the Submit button. Standard music condition IDs are retained; the publication service remains responsible for category-specific condition validation.

## Reference evidence
- Native `services/listingEditorService.ts`: existing editor RPC and localized taxonomy aspect normalization.
- Native `shared/specialistIntelligence.ts`: music media/sleeve concepts and live-taxonomy requirement.
- Native `20261030_specialist_draft_command.sql` and `20261030_publish_claim.sql`: saved specifics format and claimable status contract.
- eBay condition IDs: https://developer.ebay.com/api-docs/sell/static/metadata/condition-id-values.html
- Observed eBay music grading vocabulary: https://pointandsell.com/guides/vinyl-record-grading-on-ebay ; runtime taxonomy values take precedence.

## Verification boundary
Added regressions for exact grading text, formats, legacy metadata retention, stale hydration, review-state submission and single-request publishing. They are included by the existing GitHub workflow's `node --test scripts/test/*.test.mjs` command. No test runner or live seller session was available in this editor session; test execution, browser acceptance and actual eBay publication remain unverified. No production listing was submitted by the editor and no backend/account/credential configuration was changed.
