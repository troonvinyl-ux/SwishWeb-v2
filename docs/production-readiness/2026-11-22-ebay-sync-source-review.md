# SWISH native eBay sync source review — 22 November 2026

**Native merged source:** `troonvinyl-ux/SWISH@a6a0b0ef2b83beb0d6c4ea455abda2447e65859a` ([PR #175](https://github.com/troonvinyl-ux/SWISH/pull/175)). **Web candidate:** `troonvinyl-ux/SwishWeb-v2` [PR #6](https://github.com/troonvinyl-ux/SwishWeb-v2/pull/6). This is a **source compatibility inspection**, not a production release approval.

## Change comparison

- Native baseline: `bb3634f6c531851c49b03b21a5731f48809fa9c0`.
- Native verified main: `a6a0b0ef2b83beb0d6c4ea455abda2447e65859a`.
- Changed source roots: `supabase` (eBay sync/OAuth and Edge strict-type repairs) and `services` (regression tests). The new `deno.json` is separately tracked as root 21 to detect future changes to Edge dependency installation.
- Unchanged: `app`, `constants`, `contexts`, `hooks`, `template`, `shared`, `niches`, `niche-modules.json`, `.github`, `scripts`, `app.config.js`, `package.json`, `components`, `assets`, `app.json`, `eas.json`, `pnpm-lock.yaml`, `release`.
- The 21 tracked source root Git object hashes were checked against the complete native merge-commit tree, and `CAPTURE_SOURCE_COMMIT` was aligned to this **same merge SHA**. Capture profile source files themselves did not change.
- No separate cloud backend, database, or new Edge Function was created. Existing functions `swish-ebay-sync` and `swish-ebay-oauth` require deployment to the existing OnSpace Cloud backend to affect live behaviour.

## Contract and workflow impact

| Workflow | Native implementation | Web implementation | Remaining runtime verification |
|---|---|---|---|
| eBay linked-item synchronization | `swish-ebay-sync` now compares JSON-structured original photos by content, not object reference; returns safe item-specific failure codes and external eBay Item IDs; preserves unconfirmed statuses and original media | PR #5 previously corrected 503 partial counters and the false seller disconnect label; this PR does not trigger sync automatically | Confirm the live deployed function revision, then review the specific failing eBay Item ID after the 108 previously confirmed records; no invented success or retry |
| Connected seller identity | `swish-ebay-oauth` validates newly authorised identity against eBay's commerce identity endpoint; `verify_connected_identity` is owner/admin-only and compare-and-swap updates existing encrypted connector identity without another consent grant | PR #6 adds an explicit **Verify seller ID** button only for connected accounts without a recorded ID; it checks the persisted identity on readback | Confirm the backend is deployed and that the signed-in owner/admin can read back the same seller name; mismatch must be denied |
| Barcode catalogue merge | Deno tests revealed and fixed release-year provenance loss on AI/catelogue agreement; unknown metadata is not fabricated | No new barcode endpoint or web workflow | Verify on an actual permitted sample without paid retry |
| Orders, finance, category and identification | Type-only compatibility fixes allow all native deployable functions to pass Deno typecheck; protected scope and billing logic retained | No new web purchase, dispatch or listing permission | Authenticate browser flows and verify exact account/module/RLS behaviour |
| Native build | Existing GitHub/Expo workflows and code paths preserved, no new APK workflow | Web Vite build and niche mapping remain independent | Actual Android build and browser acceptance remain separate |

## Evidence and release boundaries

The native feature-related checks included all Edge Function typechecks, eBay sync regression tests, client TypeScript, photo persistence and barcode checks. See successful runs attached to native PR #175. Web CI still needs to finish on the updated web commit.

**Approval state intentionally remains `pending`.** The full web release verifier requires an actual merged source-review PR with a non-author owner approval on the latest PR head, exact pin snapshot, and authenticated browser evidence. A GitHub merge and a locally edited `approved` string are not substitutes. Do not claim that these source changes are already live on `swishflip.co.uk`, or that all 109+ eBay records have reconciled.

The web source-contract workflow may pass with a genuine reviewed pending candidate; the separate production release gate remains protective until required evidence exists.
