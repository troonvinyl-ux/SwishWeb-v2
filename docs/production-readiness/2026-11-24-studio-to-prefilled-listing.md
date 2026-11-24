# Full-screen Studio → researched, prefilled listing

## Implemented

Specialist workspace capture actions now open `/studio/:niche`. The quiet, full-screen shared browser camera remains the capture surface, with retained original photos and bottom guidance. Done hands off generic and coin capture to `/quick-list/:niche`; music retains its dedicated Discogs workflow. Legacy `/scan/*` routes remain available rather than replacing specialist tools.

The quick-capture pipeline now persists the same canonical item, attaches original photos, concurrently requests the existing market-value service and scoped eBay category service, obtains current aspects and condition choices, then invokes the existing listing generator and canonical draft RPC. A preparation checkpoint prevents repeating completed enrichment or generating another draft on readback retries. Completed preparation opens `/listings/:id/edit` directly instead of the limited title/description-only intermediate review.

The full editor displays market estimate, recommended price, returned verified-sale evidence and active asking prices separately. It retains original photos, editable title/description, quantity/SKU, category, condition, specifics, specialist grades, auction options and existing seller-policy handling. Only the backend's explicit recommendation prefills a recommended selling price; a market midpoint is not converted to a listing price. Refreshing market research does not overwrite the seller's price. Unavailable research leaves an honest partial draft.

Condition is prefilled only where seller-supplied condition maps to supported choices. Missing condition must be selected after physical review. No model name alone is converted to an MPN, no release country proves manufacturing origin and oversized specifics are not silently truncated. Clear condition IDs remain clear through save and metadata retention. The editor checks required specifics before enabling Submit; the existing authoritative eBay pipeline still performs final validation, seller binding and publication/reconciliation.

Tunes pricing runs after an individual release is selected and the seller reviews its details. Its suggested price fills an unedited price field; manual price edits are retained. Draft preparation also obtains the current category and eBay specifics. Missing-disc disclosures survive generation and draft creation, and incomplete/unknown physical sets do not include an unquestioned complete-release tracklist. Valuation instructions explicitly distinguish physical contents from the catalogue release.

The Studio handoff delivers a retained session once, including during React effect replay. Existing account/tenant checks, coin reference/measurement gates, entitlement checks, canonical IDs and uncertain-submission recovery remain in place. Nothing automatically publishes.

## Files

- Capture: `src/pages/NicheWorkspace.tsx`, `src/pages/ListingStudio.tsx`, `src/components/features/QuickCaptureWorkspace.tsx`, `src/hooks/useQuickCapture.ts`, `src/hooks/useStudioHandoff.ts`.
- Shared preparation: `src/lib/quickCaptureFlow.ts`, `src/lib/capturePersistence.ts`, `src/lib/scanListingEnrichment.ts`, `src/lib/scanListingFields.ts`, `src/lib/scanMarketResearch.ts`, `src/types/capture.ts`.
- Review: `src/pages/ListingEditor.tsx`, `src/components/features/ListingMarketSummary.tsx`, `src/hooks/useListingMarketValue.ts`, `src/components/features/ListingCategoryFields.tsx`, `src/components/features/ListingSaleFields.tsx`, `src/lib/listingEditorSave.ts`, `src/lib/listingEditorMetadata.ts`.
- Music: `src/pages/TunesCapture.tsx`, `src/hooks/useMusicSale.ts`, `src/lib/musicPersistence.ts`, `src/lib/musicListing.ts`, `src/lib/musicQuickSale.ts`, `src/types/music.ts`.
- Compatibility fix: undefined `imageUrls` in `src/pages/NicheCapture.tsx` now uses its successfully uploaded `mediaUrls`.
- Tests: `scripts/test/studio-listing-prefill.test.mjs`, `scripts/test/music-persistence.test.mjs`, `scripts/test/scan-listing-enrichment.test.mjs`.

## Reused services and backend

Existing singleton `src/lib/supabase.ts` still targets `https://iwgaqieyoahmcjfziwga.backend.onspace.ai`. No URL, public key, secret, auth flow, backend function or database schema was changed. The editor's builder-management backend was not used to create a parallel SWISH database.

Reuses `swish-identify`, `swish-market-value`, `swish-ebay-category`, `swish-ebay-list` condition policies, `swish-list-generate`, `swish_create_listing_draft`, shared editor save/retention, Numista/Discogs adapters, and existing module/publication guards. Runtime writes occur only in the existing authenticated SWISH workflow, using canonical records and original-photo storage.

The fetch of native `docs/SWISH_LISTING_STUDIO_V2.md` from main returned no readable source in this session. No exact native V2 contract parity or `studio_observe` deployment is claimed. This enhancement uses the existing, inspected web/shared contracts; it introduces no alternate AI engine.

## Verification status

Regression tests added for explicit recommendation versus midpoint, seller corrections, first-photo research→draft order, canonical draft reuse, unavailable research, stale workspace rejection, bounded market summaries, condition/content safeguards and Studio→full-editor routing. Existing fixtures were updated for the enrichment stage and new workspace entry route.

Automated tests/typecheck/build/lint: **not executed in this editor session**; no command-execution tool is available. Existing `.github/workflows/web-verify.yml` runs `node --test scripts/test/*.test.mjs`, TypeScript, build and lint when the changes reach GitHub. This report does not claim CI passed.

Authenticated backend/function deployment revision: **not verified**. Browsers/devices tested: **none**. Live Discogs/Numista lookups and eBay publication tests: **not performed**. Production publication: **not requested**. GitHub commits/PRs: **none created by this session**.

## Acceptance checks still needed

1. Verify authorised coin, tech, clothing, stamp and Tunes sessions against the connected SWISH deployment.
2. Capture→Done→research→editable draft, including slow/failed market research and missing required specifics.
3. Tunes catalogue selection, reviewed grades/counts, automatic pricing, incomplete releases and seller price preservation.
4. Phone/tablet/desktop, portrait/landscape, published HTTPS camera permissions and OnSpace iframe upload fallback.
5. Account/tenant changes, effect replay, interrupted saves, readback retries and no duplicate canonical items/drafts.
6. Explicit seller submission, supported conditions, required specifics, verified seller binding and confirmed-live versus pending/failure reconciliation. Do not publish in production without approval.
