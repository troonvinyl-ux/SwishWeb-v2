# Native presentation, stock-listing overview and Smart Studio parity

## Source of truth
User-supplied native screenshots and `troonvinyl-ux/SWISH` main: `app/stock-listing/[id].tsx`, `shared/smartStudio.ts`, `services/existingImageStudioService.ts`, `services/smartStudioStorageService.ts`, `services/marketValueService.ts`, and `supabase/functions/swish-coin-image-enhance/index.ts`.

## Changes
- Retain the inviting web scan composition; use the app's graphite surfaces, gold emphasis, rounded panels, padded controls, lifecycle borders and circular camera destination. No browser status/address bar is simulated.
- Listing rows open a stock-listing overview, not the editor. The original editor is retained at `/listings/:id/edit`. Inventory and listing read views share Overview, Market value, Re-ID and Photos sections.
- Separate market estimate, recommended listing price and actual saved eBay price. Missing/zero estimates are displayed as unavailable, not invented £0.00 values.
- Re-ID uses original photographs. A suggestion changes only an inventory title after explicit confirmation and version checking. Market refresh uses the existing native request contract; neither action publishes or changes eBay prices.
- Display app-generated `_smart_studio_images` linked to their original media, requiring the current BackgroundErase version and fidelity checks. Original photo order and generative-reference exclusions are preserved.
- Reuse the existing `swish-coin-image-enhance` gateway with tenant, niche and item scope. Associate returned presentations using fresh attributes, optimistic concurrency and readback. No new backend, schema, provider key or AI model is created. Coins queue this same preparation after original scan photos are durably saved; legacy items have an explicit per-photo retry.
- Gallery offers prepared/original comparison with keyboard-accessible, focus-trapped previews. The listing editor offers both verified cutouts and original photographs; selected order is the seller's explicit publish selection.

## Verification still required
The editor tools cannot execute local commands or authenticate as a real SWISH seller. `scripts/test/item-detail-studio.test.mjs` adds regression coverage and will run in the existing web verification workflow. Do not treat added tests as executed/passing evidence. Existing tests and build must be run through GitHub Actions.

On real iOS Safari and Android Chrome, check scan layout at 320–430px, capture both faces, wait for original persistence and studio completion, compare cutout/original, open stock/live listing overview and refresh value/Re-ID. Confirm BackgroundErase is deployed on the existing SWISH backend and returns current provenance; if unavailable, original photos remain visible and processing errors are actionable. No backend provisioning or live-account changes were performed by this editing session.
