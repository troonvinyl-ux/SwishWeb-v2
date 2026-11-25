# SWISHFlip Rapid Coin Listing / Collector's Envelope Mode

## Scope and release status

Implemented in the current web workspace for `troonvinyl-ux/SwishWeb-v2`. This is an adapter to the original SWISH services, not a new application, database or publisher.

**Not yet verified for release:** the available builder tools cannot run Node/TypeScript/build/browser tests or create a GitHub commit. No main-branch commit, deployment, real handwriting accuracy result, authenticated seller check or 50-coin device throughput result is asserted in this document.

Backend binding is unchanged: `https://iwgaqieyoahmcjfziwga.backend.onspace.ai`. The builder's separate `wkcxmsmywyxsavhkwkcx` database was inspected read-only; it has neither `items` nor `listings`. No SWISH schema or user data was created or changed there.

## Entry and seller workflow

- Coin workspace and existing scanner expose **Rapid Listing** at `/rapid/coins`.
- Choose Standard identification or Collector's Envelope Mode.
- Capture original obverse, reverse and envelope/ticket. Third photo starts a 2.5-second auto-queue window. A visible **Add more evidence** action pauses it. Done can queue two standard-mode faces manually; Envelope Mode requires its evidence photo.
- Capture immediately continues on the next coin while up to two preparation jobs run. Additional photographs are retained (up to twelve); at most eight bounded copies enter a single shared analysis call.
- Weight, diameter, references and notes are optional. A entered Numista reference requires explicit seller confirmation and uses the existing direct Numista fields and face-comparison contract. The native capture-mode configuration is loaded rather than inventing a new backend capture mode.
- Review uses the existing `ListingEditor` in place. Description, specifics, pricing, delivery and photos are its existing sections; collector evidence is an expandable companion panel.
- Persistent review controls: List & Next, Save & Next, Edit, Review Later. Selecting batch rows is not approval; a separate confirmation authorizes sequential submission of selected reviewed drafts. Refresh/navigation discards that transient approval, not the captured work.

## Storage and recovery contracts

- Originals are stored as browser IndexedDB blobs, separately from queue metadata. Transactions are awaited before remote mutations. Browser persistent storage is requested where supported.
- Queue and images are scoped by authenticated seller and tenant. Logout/account switching hides previous seller data; it does not destroy that seller's originals. This is device/origin storage, not a cross-device queue. Clearing browser data, private-session expiration, unavailable IndexedDB or browser eviction can still remove unsynced local work.
- Queued work runs while the authenticated web app is open in the coin workspace. Closing/suspending the browser pauses work; reopening resumes recoverable processing checkpoints. No claim of a background service worker or processing after browser closure is made.
- A UUID assigned at capture identifies the physical inventory item. Reusing that exact ID and checking `_rapid_capture_id` prevents an uncertain item insert from being replayed as a different inventory record. Titles are never identifiers.
- Original storage paths include a content hash and capture slot. A lost upload reply is recovered only after verifying stored bytes against the original hash; originals are never overwritten.
- Draft creation reuses `prepareStableQuickCapture` and `swish_create_listing_draft`; a durable `draftAttempted` checkpoint and existing-listing lookup stop blind draft recreation after an uncertain result. Seller inspection may still be needed when the authoritative service cannot confirm the original draft.

## Shared services and evidence

- `swish-identify`: both coin faces, collector envelope, primary collector-led research instructions, explicit source separation and expected `attributes.collector_envelope` / `photo_roles` evidence.
- Existing Numista direct lookup and image-face preparation: seller-selected reference is the research anchor, not proof of physical authenticity; discrepancies are displayed rather than converting low confidence into an automatic listing blocker.
- `swish-market-value`: existing completed-sales/catalogue/auction/asking-price research. Valuation instructions prohibit confidence-only devaluation. Quick Sale uses only the shared engine's returned `quickSaleRatio`; no invented discount is substituted if it is missing. Sold medians require positive verified-sold counts; active asking medians are labelled separately.
- `swish-list-generate`: original item and its persisted evidence / professional-generation instructions. Buyer copy has an 80-character title cap, retains justified attribution qualifications, and strips confidence-led sentences rather than inserting percentages or automatic low-value wording.
- Existing BackgroundErase: optional. Only source-pixels-only/fidelity-passed outputs are selected; originals and internal envelope evidence are retained. No artificial coin image generation is introduced.
- Existing delivery-policy screen and server-side saved delivery preferences are reused; no arbitrary postage policy is manufactured.

**Backend contract requiring live verification:** the existing deployed identification service must return collector transcription and structured source fields requested through its existing multimodal request. This client does not deploy a new OCR worker or change the original backend's schema. If the deployed worker omits these fields, the draft remains available with an explicit transcription-unavailable notice and the original envelope. That fallback is not counted as successful handwriting extraction. Verify or extend the original shared worker in the native/SWISH repository if its current response normalization discards these fields.

## Publication integrity

The existing `useListingEditorActions` and `swish-ebay-list` remain the only publisher. Rapid jobs journal `publishing` before invocation and `accepted_pending` plus the exact returned ItemID before live readback. An accepted HTTP-error body is also retained. The accepted-ID browser journal now uses localStorage as well as sessionStorage.

The original shared backend owns seller linkage, publish claims, `listings.status = active`, `items.status = listed`, and atomic accepted-publication reconciliation. The web does not forge those states. A job becomes Published only after the existing listing/stock verification. Original seller/tenant/listing/item identities are retained.

Network errors without a confirmed result remain uncertain. Saving edits cannot downgrade an uncertain or accepted job back to publishable. Recovery calls the existing exact-ID `recover_pending_publish` / status path, never another AddItem request. Existing backend deployment requirements and missing-worker repairs remain relevant; this feature does not redeploy the native backend.

## Learning evidence

Explicit seller-confirmed corrections use the existing native `ai_id_feedback` columns and a durable feedback ID. AI suggestions are stored as suggestions, not positive confirmed training examples. Collector/catalogue/visual/unresolved evidence remains distinct. Seller prices remain the canonical saved listing prices; realised sales remain in the existing authoritative orders/sales/inventory synchronization, not in a manufactured asking-price training ledger. No separate model-training backend is introduced.

## Added regression coverage

- `rapid-coin-queue.test.mjs`: fifty durable jobs, two concurrent browser-wide processing claims, lease recovery, original byte preservation and account isolation.
- `rapid-coin-policy.test.mjs`: collector provenance, uncertainty handling, envelope exclusion, professional copy and existing-editor reuse.
- `rapid-coin-publication.test.mjs`: atomic publication journal, accepted-ID retention, no downgrade/identity replacement, scope isolation and no uncertain replay.
- `rapid-coin-preparation.test.mjs`: three-photo shared preparation, primary collector notes, native capture mode, Numista input contract, low-confidence non-blocking and backend-unavailable recovery.
- `rapid-coin-recovery-pricing.test.mjs`: lost item-insert response, uncertain draft guard, optional unknown measurements, pricing independence from AI confidence and sold/asking separation.
- `rapid-coin-learning.test.mjs`: explicit seller correction, original item linkage, retained feedback retry ID and account isolation.

Tests use mocked service responses and a transactional browser-storage test double; they do not establish real OCR accuracy, backend RLS, eBay success, or actual throughput. The existing CI runs every `scripts/test/*.test.mjs`, typecheck, build and lint on main/PRs.

## Required verification before committing verified changes to main

1. Run `node --test scripts/test/*.test.mjs`.
2. Run `npx tsc --noEmit -p tsconfig.app.json`, `npm run build`, and `npm run lint`.
3. Test real legible/partly-illegible envelopes with obverse/reverse images; confirm returned structured transcription, reference anchoring and exact discrepancies.
4. Test iOS Safari and Android camera/gallery, zoom, one-handed Add more evidence, refresh, offline recovery, account switching and at least fifty coins. Measure actual processing/queue times.
5. Use an authenticated seller in the original tenant/module to inspect category/condition/specifics/valuation/delivery and background-removal fidelity.
6. Approve a controlled real/sandbox listing only with seller consent; verify original ItemID, seller binding, listing Active and stock Listed. Simulate lost response/accepted-but-unreconciled recovery and verify no second publication.
7. Verify supported existing order/sales synchronization records realised sale evidence; do not label unsold asking prices as confirmed sales or training data.
8. Review the diff in `troonvinyl-ux/SwishWeb-v2`, then commit verified changes to `main` through authorized GitHub tooling. No commit has been made from this builder session.
