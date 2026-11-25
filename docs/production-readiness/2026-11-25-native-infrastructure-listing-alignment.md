# Native infrastructure and listing alignment — 2026-11-25

## Inspected authority

Native repository: https://github.com/troonvinyl-ux/SWISH
Inspected revision: `08e0eb7c04590e64ef00837b228316f1b1c5a1a5`.
The web source pin remains a **pending review candidate**, not full parity or release approval.

Source reviewed at the exact revision:
- `services/backendRequestService.ts` and `services/backendAvailabilityService.ts`: session-partitioned pending reads, two-read concurrency, access priority, bounded waits, no mutation replay, transient failure distinct from authorization failure.
- `app/ebay-listing-editor.tsx`, `hooks/useListingEditor.ts`, `components/feature/ListingReadyPanel.tsx`: photo-led review, direct price entry, market estimate separated from selling price, buyer-facing description, progressively disclosed details.
- `shared/listingClarification.ts`: actionable field/account/connection/status guidance, advisory AI confidence.
- Native commits `ffb03b5`, `ab23a4c`, `08e0eb7`: exact item-number recovery, legacy SKU-less pending drafts and accepted-publication reconciliation against the original claim.

## Web changes

- Introduced a shared session-scoped read governor for generic table/row/count reads, canonical inventory pages/counts, primary tenant resolution and current-module reads. Reads share only pending work, use two dispatch slots, include queue time in a 12-second deadline and check session identity before dispatch and after response. Brief transient-failure suppression is bounded in memory. Save/publish/recovery/end requests are never automatically replayed by the governor.
- Module activation is serialized and only identical pending activations are shared. An existing server module must be read back; local storage never grants authorization.
- Preserved the GitHub SWISH shell, teal selling-workspace palette, two-column overview, section routes, photo controls, music specifics, market research and selected delivery-policy display. Listing colors now use scoped semantic HSL tokens; new controls retain focus/disabled states.
- Replaced the dense listings table with photo-led cards and URL-backed status/search filters. Pending claims remain visible under Needs attention. Dormant drafts for already-live stock are not shown as waiting for a second publication. Search operates on saved, tenant/niche-scoped results, not a backend request per keystroke.
- Added direct validated price entry, a saved-photo rail, market-estimate disclosure and a text-only buyer-description preview. Unknown evidence remains unknown. Publication uses a separate accessible confirmation and existing shared server validation.
- Required item-specific metadata must actually have returned before the web review can be treated as ready; absent metadata is not an empty successful requirements check.
- Retained eBay-confirmed item numbers in user/tenant/listing-scoped tab recovery storage, without tokens or browser-created claims. Refresh/remount cannot silently replay an accepted publication while its server reconciliation is pending.
- Recovery uses only `recover_pending_publish` with the exact existing listing and eBay item number. The backend verifies the current seller, original claim and any legacy evidence. Success requires retained identity, released claim and canonical Live stock. No direct client status writes are used to manufacture Live/Sold state.
- Publication feedback directs sellers to the requested item details, policy, connection, account or original submission instead of asking for more AI certainty.

## Backend boundary

The browser remains bound to the existing SWISH backend:
`https://iwgaqieyoahmcjfziwga.backend.onspace.ai`.

The editor workspace's Cloud tools describe a different project (`wkcx…`). No SQL, migrations, secrets, backend rebinding or function deployment was performed there. No replacement backend was created. Do not assume GitHub source changes have deployed to the original SWISH Cloud.

The native atomic `swish_recover_pending_ebay_publish` RPC and complete shared function deployment still need verification in the original Cloud project. Worker/import failures are not repaired merely by this frontend alignment. No eBay publish/revise/end was performed during development.

## Regression coverage added

- `native-backend-reads.test.mjs`: pending-only deduplication, priority, two-read dispatch limit, session changes, deadlines, retry suppression and auth-denial distinction.
- `native-listing-recovery.test.mjs`: original claim route, exact item number, tenant scope, stock readback, legacy draft handling and scoped accepted-ID retention.
- `native-listing-presentation.test.mjs`: status presentation, safe text-only descriptions, preserved GitHub overview and syntax diagnostics.
- Updated existing direct-submission/inventory service fixtures and delivery-layout assertions for the aligned code.

Run locally or in GitHub:

```sh
node --test scripts/test/*.test.mjs
npx tsc --noEmit -p tsconfig.app.json
npm run build
```

No shell runner was available in this editor session. These checks were **added/updated but not executed here**. They do not establish live account acceptance.

## Remaining verification and scope

Test browser session replacement, slow/pool-exhausted backend responses, cross-niche activation, draft save/reopen, auction price retention, mobile/touch controls and accepted-publication recovery using an authenticated seller against the original SWISH Cloud. Verify source-review approval and refresh release evidence before publication.

This is alignment of the inspected infrastructure and listing-review paths, not a blanket claim that every native screen is ported. Native-only update/Expo capabilities remain outside this React/Vite client. Full live-content revision/comparison, payment return URLs, Studio V2 deployment, device camera testing and production marketplace acceptance remain separate existing parity gaps. Existing live listings are still guarded against unintended client publication or editing; this pass does not imply a newly verified live revision workflow.
