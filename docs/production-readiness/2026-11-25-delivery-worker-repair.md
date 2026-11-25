# Delivery lookup boot failure — preserve GitHub design

## Diagnosis and boundary

The provided iPhone screenshot shows `swish-ebay-list` failing during worker module-graph creation, before the delivery route runs. It reports a missing `../_shared/d…` module; the cropped screenshot does not establish its complete filename. Repeated retries, reconnecting eBay, changing dispatch days, or reverting the web design cannot repair a missing server dependency.

The web app and native source point to the existing SWISH backend `https://iwgaqieyoahmcjfziwga.backend.onspace.ai`. This editor's Cloud tools are bound to a different project (`wkcxmsmywyxsavhkwkcx`). No replacement functions, tables, credentials or backend changes were made in that project. The log tool could not access the SWISH function. No backend repair/deployment is claimed.

## Implemented web repair

- Retained the GitHub listing layout, brand, colours, pricing controls, dispatch chips and policy-success presentation. `src/index.css`, `ListingEditor.tsx`, headers, navigation and camera files are untouched.
- Constrained the delivery fieldset's intrinsic minimum width and allowed text/button wrapping. This addresses horizontal overflow without masking it with global overflow clipping.
- Replaced raw exception interpolation with classified, actionable messages. Missing modules/boot errors clearly require a backend deployment repair; no internal file paths or stack traces are rendered.
- Kept scoped authorization and the existing read-only `get_selected_delivery_policy` route. Never query connector credentials, infer a default policy, silently change selected policies, or display template postage as verified.
- Validate the response: only an explicit valid `policy: null` means no policy was selected. A malformed success response remains an error.

## Required repair in the original SWISH project

Source inspected read-only: `troonvinyl-ux/SWISH` commit `7998a6a247eeee0dacaa69cbc32fdcc5ab0873e2` (25 November 2026).

1. In the original SWISH Cloud project's Edge Function logs, read the full `swish-ebay-list` boot error and identify the exact missing import. Do not redeploy this function into the web editor's unrelated Cloud project.
2. Use the corresponding reviewed native source revision. It must include the `get_selected_delivery_policy` route introduced by `7998a6a…`, plus the complete transitive function dependencies, not just `swish-ebay-list/index.ts`. The same revision includes `_shared/deliveryProfileRoutes.ts` and `_shared/deliveryPreferences.ts`; copy their exact source, not dummy substitutes. Keep JWT, membership, paid-niche, seller-binding, encryption and publishing guards intact.
3. Before deploying, check the source graph from this web repository: `node scripts/check-ebay-function-graph.mjs /path/to/SWISH`. From the native repository, also run `deno cache --reload supabase/functions/swish-ebay-list/index.ts` to resolve external/dynamic dependencies. The local graph check is packaging assistance, not proof of runtime health.
4. Restore any missing files in the original OnSpace project and redeploy `swish-ebay-list` with its complete shared dependency graph using that project's established deployment process. Editing GitHub alone does not prove the deployed worker has those files.
5. Sign in to the existing seller workspace and retry Delivery. Confirm that the selected policy ID matches eBay, domestic/international services and charges are correct, and absent charges/collection eligibility remain explicitly unknown. Verify the same read-only request in native and web.
6. Test an iPhone-width viewport: no sideways page growth, visible retry controls, unchanged dispatch chips, and the existing Save/Done action accessible by scrolling. Publication must continue to use the existing shared backend gates; do not publish as a diagnostic test.

## Verification status

Added policy/error/layout regression tests and a local dependency-graph check. This session has no command runner, authenticated SWISH backend access, deployment credentials, or real-device browser access. Tests were added, not executed; restored policy retrieval and live publishing are unverified. Source-sync baseline and release approval were not advanced.
