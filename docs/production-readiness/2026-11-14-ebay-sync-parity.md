# Web eBay sync correction — 14 November 2026

Source inspected: `troonvinyl-ux/SWISH` commit `52e7a44af940e6d684b241b914ec470853072791`.

## Cause
The native Edge wrapper (`supabase/functions/_shared/moduleScope.ts`) requires a server-held module returned by `swish_current_module`. The web client only saved the selected niche in browser storage. A connected eBay seller account is not module authorization, so `swish-ebay-sync` correctly rejected the request with “Open an entitled module in the unified SWISH shell before using this operation.”

## Frontend changes against the existing backend
- Specialist routes wait for the existing native `swish_open_module({ p_tenant_id, p_niche_id })` RPC, require `true`, and verify `swish_current_module` readback. General niche selection, onboarding and owner administration are not implicitly activated as specialist modules.
- No role inferred from an email, hostname or browser preference can bypass this gate. No backend migrations, credentials, Stripe setup or replacement services were created.
- Hub Sync, eBay Listings Sync and Command Centre eBay Full Sync share one client runner adapted from native `services/ebaySyncService.ts` and `services/syncRequestService.ts`.
- Requests send `tenantId`, canonical `nicheId`, `mode: 'full'`, `batch: true`, verified `afterListingId` continuations and, where required, `previousIssues: true`.
- Each Edge request has the native 105-second wait bound; in-flight requests are deduplicated. Expired access tokens can use the backend's existing refresh consent instead of requiring immediate reauthorization.
- Authentication and server-held module identity are checked before dispatch and after response. A module/login change stops continuation; no authorization repair or mutation retry occurs inside the batch runner.
- Only the app's fully accounted-for eBay policy `21920397` restriction permits another disjoint batch after a partial failure. Unknown failures, JWT rejection, unconfirmed results and invalid/repeated cursors stop.
- Completed totals and listing issues remain visible. Saved marketplace queries refresh after completion or partial failure; the client does not report failed HTTP-200 payloads as success.
- Removed the eBay Listings page's extra automatic image-download call: full sync now follows the app's sync contract rather than adding an unrelated operation.

## Validation status
Regression tests added in `scripts/test/ebay-sync.test.mjs`; the existing `web-verify.yml` already includes every `scripts/test/*.test.mjs` file. Test execution, TypeScript checking and live seller sync were not available in the builder tools during this change, so this document does not record a passing test run or production acceptance.

Run `node --test scripts/test/*.test.mjs`, `node scripts/verify-web-parity.mjs`, `npx tsc --noEmit -p tsconfig.app.json`, and `npm run build` in the repository's CI. Then verify with an existing entitled SWISH account: direct eBay entry, multiple sync batches, token refresh, revoked entitlement, module change mid-sync and eBay policy restrictions. Compare saved listings/items with the native app without republishing.

The source pin and pending release approval remain unchanged. This fix does not prove the builder's Cloud management binding or full web/native parity, and does not authorize publishing.
