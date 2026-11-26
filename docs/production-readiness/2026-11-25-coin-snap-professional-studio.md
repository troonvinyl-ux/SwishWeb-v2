# Coin Snap — professional paired photographic presentation

## Implemented scope

This is an extension to the original SWISH Smart Studio, not a new scanner, database, image provider or publisher. Web entry points and the existing listing editor are preserved. No artificial coin photographs were generated.

The web now requests `route: 'coin_pair'` on the existing `swish-coin-image-enhance` endpoint. Both originals must already belong to the same verified seller/tenant coin. Existing quick capture and rapid listing call the same preparation path automatically before draft generation. Initial identification and research continue to use originals, never edited presentations. Optional processing failures return the original photographs and do not stop listing preparation.

Professional output is two separate opaque PNGs, each 1600 × 1600, with an exact white background and approximately 1440px maximum coin extent. Obverse/reverse dimensions are consistently fitted; irregular silhouettes are not forced into circles. The existing listing selector exposes both originals and derivatives, labelled “Coin Snap · 1600px”. No processing screen or new approval step is added. Existing seller photo selections are preserved.

## Single shared engine extension

Canonical portable geometry, mask checks, source sampling and rendering live in `supabase/functions/_shared/coinStudio*.ts`. They are an extension to the original native repository's `smartStudioEngine.ts`, codec and `backgroundEraseService.ts`. There is deliberately no new Edge Function `index.ts` or alternate client pixel engine in this web project.

`coinStudioRoute.ts` is installed INSIDE the existing authenticated `serveModule` handler. It reuses original OnSpace Cloud storage and verified resource access. The existing BackgroundErase provider remains the only segmentation provider. OnSpace AI (`google/gemini-3-flash-preview`) supplies conservative quality/mask/face-consistency assessment, not generated image content. Existing injected AI credentials are used server-side only. No provider credentials were copied to the browser or requested for the unrelated builder project.

The pure modules have no DOM dependency; native and web clients request the same server route. Native client integration must send its bounded original processing copies and attached original URLs to this route rather than implementing another renderer. The original native repository has not been modified by these file tools.

## Photographic safeguards

- Provider RGB is discarded. Only segmentation alpha is used; every rendered foreground sample comes from the original photographic processing copy.
- AI contours validate the provider mask. They NEVER draw rims, fill gaps, invent inscriptions or fabricate holes.
- Clipped/occluded rims, ambiguous objects, unsafe holes, severe unrecoverable glare, insufficient optical resolution or failed pair matching fall back to originals.
- A repeated image or repeated same-side pair cannot be certified as obverse/reverse.
- Optional axis correction is capped at 6% and requires reliable evidence of a regular circular planar coin. Hammered/irregular/damaged flans are not stretched into circles. Unsupported perspective stays unchanged.
- Optional illumination and sharpening use existing pixels only. Per-channel adjustment is capped at two 8-bit levels, with no introduced clipping, healing, smoothing, white balance, despill, metal recolouring or generated texture. Unsupported lighting remains untouched; worn/dark/tarnished coins are not rejected merely for wear.
- Output fingerprints bind the audit to the exact photographic processing copies. PNG storage is content-addressed and byte-read back before a pair manifest is accepted. Resizing to 1600px is not super-resolution and does not claim additional captured detail.
- New presentations require strict paired metadata and deterministic quality checks. Legacy white cutouts are not relabelled as professional-pair success.
- Source URLs and processing-copy hashes are provenance, not a certificate of physical authenticity. AI assessment can still make errors; real original/output comparisons remain required release evidence.
- CAS-protected item metadata preserves `items.media`, collector envelopes, seller facts and original evidence. No marketplace state, identification claim, grade or selling price is changed by this extension.

## Original backend deployment is required

**Not deployed:** the builder's Cloud database (`wkcxmsmywyxsavhkwkcx`) was checked read-only and has no SWISH `items`/`listings`. The web binding remains `https://iwgaqieyoahmcjfziwga.backend.onspace.ai`. No duplicate schema or replacement endpoint was deployed to the builder project.

The inspected original worker currently returns basic cutouts without the requested professional pair certification. Until its extension is deployed, the web safely selects originals and reports that professional processing is unavailable. This is not claimed as a completed live 1600px processing result.

From authorized tooling with both repositories checked out:

1. Run `node scripts/install-coin-studio.mjs --repo ../SWISH` in the web repository. Default is a non-writing compatibility check.
2. Review the generated handler extension and shared files. Apply with `node scripts/install-coin-studio.mjs --repo ../SWISH --apply`.
3. The installer requires the original authenticated handler and its existing `smartStudioEngine.ts` / `backgroundEraseService.ts`; it fails closed if the native gateway has drifted. It copies the canonical shared modules byte-for-byte and adds only the pair branch. Existing single-photo routes remain intact.
4. Run native/Deno checks against the installed original handler and complete provider/module-scope integration tests. Confirm the existing BackgroundErase and OnSpace AI server configuration in the original SWISH project.
5. Deploy `swish-coin-image-enhance` with its complete existing shared dependency graph in the ORIGINAL SWISH Cloud project, not this builder's database. Configure the native Done adapter to use the same pair route.

No remote deployment, main-branch commit or native repository write is asserted here.

## Regression coverage and verification status

Added `coin-studio-{raster,contract,persistence,workflow,client,syntax}.test.mjs`. Coverage includes 20 explicitly synthetic raster variations, white 1600px exports, centring, preserved holes/irregular flans, source-only colours despite deliberately altered provider RGB, bounded photographic adjustments, input fingerprints, old-worker/network fallback, original-photo research, single canonical draft creation, cached pairs, seller switching and metadata CAS conflicts.

**These tests have been added but not executed:** this workspace exposes no shell/build/browser test tool. Synthetic fixtures do not establish real numismatic fidelity or count as the requested 20 actual coin photographs. Run:

```
node --test scripts/test/*.test.mjs
npx tsc --noEmit -p tsconfig.app.json
npm run build
npm run lint
```

## Required 20-coin photographic acceptance

Use at least 20 actual paired coins, including heavily worn copper, ancient bronze, tarnished silver, reflective modern pieces, hammered/irregular flans, dark coins, weak inscriptions, holed coins and damaged coins. Preserve original full-resolution files and compare each output directly at full scale for rim completeness, damage, patina/metal colour, worn legends and portrait detail. Verify approximately 90% fill, square white export, same-coin scale and conservative perspective. Record fallbacks honestly; glare, missing edges and missing letters cannot be recovered by invention.

The two supplied reference URLs are visual-standard examples and appear to show the same design face; they are not 20 separate original/output pairs or proof of obverse/reverse processing. No real-image acceptance results, authenticated provider success, mobile throughput measurements or live listing publication are claimed. Release remains pending those checks and original-backend deployment.
