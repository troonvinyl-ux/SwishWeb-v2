# Rapid coin retry and photograph recovery

## Screenshot diagnosis and implemented changes

The screenshot's error originates in `rapidPublicationBlocked`, before the new eBay request. The original implementation journalled every failed request as `uncertain`. Its Refresh saved status action only reread the listings table; it never reconciled the browser queue. A coin could remain permanently blocked even after a rejected/preflight request left its original SWISH listing as a draft.

- New attempts retain a local attempt identity and start time before calling the existing publisher.
- Structured rejection is separated from accepted publication, reconciliation errors, transport failures and unknown outcomes. An HTTP error without a usable structured rejection is not treated as proof of rejection.
- Refresh status checks the verified seller/module, exact original listing/physical coin ID, every scoped eBay listing for that coin, stock availability, accepted local ItemID and a second saved-listing read. It does not search by title or publish anything.
- A known rejection can recover immediately after these checks. Legacy/unknown local attempts wait at least three minutes from the attempt (legacy fallback: last queue update) before the same checks.
- Recovery changes ONLY the local queue journal to `draft_saved`. It never clears a server claim, overwrites an accepted eBay ItemID, updates remote listing/stock status or creates another draft.
- Safety relies on the original shared publisher retaining its server claim for unknown AddItem outcomes. Any retained claim, external ID, publication timestamp, recorded sibling, sold/listed/unconfirmed stock, read failure or concurrent listing change keeps retry blocked. If a server claim remains despite the seller seeing no live listing, server-side seller/attempt reconciliation is required; the web does not expire it.
- Releasing the local lock does not automatically publish. The seller reviews and explicitly approves this same draft, and the existing publisher rechecks stock and claims atomically.
- The normal editor displays the local recovery reason and refresh action, not only the rapid batch footer. A failed List & Next now stays on the current review instead of navigating away from the error. Review Later can leave a protected attempt without changing its status.

## Photo selection and existing-editor retry

The clean editor previously retained `photosRef` indefinitely after the first hydration, even when the saved item had newer prepared photos. Clean refetches now adopt the actual saved photo selection; dirty selection/title/description edits and explicit empty selections remain protected.

The existing Photos section now includes a Coin Snap pair retry button, reachable directly from the overview. It calls `prepareSavedCoinPhotos`, the same shared studio path used at capture. It selects verified prepared replacements only for the original faces that the seller selected, preserving omissions, photo order and internal envelope evidence. Verified item readback is adopted without clearing dirty listing text, so prepared URLs are immediately allowed by the existing save validator. Originals are retained.

No image generator, CSS fake crop, new image provider or browser segmentation engine was added. The genuine damaged/irregular coin in the supplied photograph must remain damaged/irregular. The white-background reference is a presentation standard, not replacement product imagery.

## Deployment limitation

The currently inspected original SWISH `swish-coin-image-enhance` source still only accepts `imageDataUrl`, without the `coin_pair` branch. This explains why the new strict client retains the original uncropped photograph. The client now reports this specific deployment mismatch rather than claiming a professional output.

Enable the existing shared extension in the ORIGINAL SWISH repository/backend:

```
node scripts/install-coin-studio.mjs --repo ../SWISH
node scripts/install-coin-studio.mjs --repo ../SWISH --apply
```

Then run the native/Deno checks and deploy `swish-coin-image-enhance` with its complete shared graph to `iwgaqieyoahmcjfziwga`, using the project's authorized deployment tooling. Do not deploy a replacement to the unrelated builder Cloud database. This session cannot deploy to that original project or certify the supplied photo as successfully processed.

## Verification evidence

Added `rapid-publication-unlock.test.mjs` and `coin-photo-editor-recovery.test.mjs`, and extended editor hydration/syntax tests. Coverage includes stale vs recent journals, rejection vs unknown/accepted outcomes, claim/ItemID preservation, stock and sibling protections, service failure, scope changes, concurrent claims, seller selections and dirty-copy preservation.

No shell/test runner is available in this session; these tests and the build were not executed. Live Preview network diagnostics contained no captured requests; the builder Cloud cannot supply logs for the original SWISH eBay function. No authenticated seller record or eBay outcome was claimed as verified, and no existing user data was changed through SQL.

Run before release:

```
node --test scripts/test/*.test.mjs
npx tsc --noEmit -p tsconfig.app.json
npm run build
```

Reopen the affected coin, press Refresh status, verify the original claim/stock checks, and explicitly submit only if SWISH releases the local lock. Confirm the same original listing ID and inventory ID receive the accepted ItemID. After the shared image-worker deployment, press Prepare white-background photos, compare both outputs to the originals, save the selected photos, and verify the white 1600px files on eBay. The previous required real 20-coin visual acceptance remains pending.
