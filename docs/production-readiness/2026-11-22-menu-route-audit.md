# SWISH web production-capability inventory — 22 November 2026

**Repository:** `troonvinyl-ux/SwishWeb-v2`, review branch `audit/web-menu-data-integrity-20261122`. **Target:** `swishflip.co.uk` web experience only. The native SWISH application is not a modification target.

**Release gate: BLOCKED.** All status descriptions below are based on source inspection and/or CI, **not authenticated end-to-end browser verification**. A route loading is never evidence of completion. **Implement/remove decisions are provisional until tested.** This inventory is not a release approval or claim of deployed behavior. Production `main` is untouched.

## Evidence and status rules
- **Partial** = a real code path exists, but a complete current-user, error/empty, persistence, narrow-screen and direct-link journey is not proven.
- **Broken** = a concrete source-level contradiction, missing implementation or failing test is identified.
- **Placeholder** = a purported action is unsupported, has a wrong destination, or only presents explanatory decoration.
- **Unknown** = no adequate browser/data/permission proof.
- **Candidate** = implementation is revised on the review branch but not verified in production.
- **Implement** = keep only once all user journeys and permissions pass; **Remove** = remove UI/navigation/search/CTA and use a controlled direct-route fallback.

## Primary signed-in navigation

| Label | Route/action | Intended job | Actual code/data source | Status | Decision | Evidence/current gap |
|---|---|---|---|---|---|---|
| Dashboard | `/dashboard` | Accurate workspace KPIs, recent work | `Dashboard.tsx`; legacy `inventory`, `orders`, `tasks`, `listings` hooks | **Broken** | **Implement or remove before merge** | Contradicts canonical `items` stock; unscoped/truncated totals. No real-data browser test |
| Command Centre | `/command-centre` | Run real syncs; inspect activity | `CommandCentre.tsx`; `activity_log`, `items`, `orders`, `swish-ebay-orders`, `useEbaySync` | Partial, candidate | Implement | Unsupported Reprice All/Batch Identify buttons and false 'Connected' removed on branch; tenant-wide counts, activity error retry remain to verify |
| App Tools & Parity | `/tools` | Real supported tools | `ParityTools.tsx`; feature links including still unimplemented parity | **Placeholder** | **Remove** | `ParityTools.tsx` explicitly contains unsupported feature descriptions; direct route still exists |
| Inventory | `/inventory` | Browse/filter stock; open drafts | `Inventory.tsx`, `useTable('items')` and `listings` tenant+niche filters | Partial | Implement | Populated/empty/search deep link, persistence, switching not browser tested |
| Stock Check | `/stock-check` | Persisted physical stock verification | `StockCheck.tsx`; `items` read plus transient checked-set state | **Broken** | **Remove until persistent stock-taking exists** | Checked flags disappear on reload; 1,000-row cap not an honest inventory total |
| Identify / Scan | `/identify`, `/scan/:niche`, `/scan/coins` | AI + reference identification and saved items | `Identify.tsx`, `NicheCapture.tsx`, `TunesCapture.tsx`, SWISH Edge Functions; Numista/Discogs where relevant | Partial | Implement | Complete error/persistence/permission/browser journey not proven; scan contract tests failing on main |
| Acquisitions | `/acquisitions` | Record sourcing costs | `Acquisitions.tsx`, `acquisitions` tenant-scoped table | Unknown | Implement if persisted; otherwise remove | Source CRUD present; no authenticated round-trip |
| Opportunities | `/opportunities` | View/work opportunities | `Opportunities.tsx`, `opportunities` table | Unknown | Implement if backend-backed; otherwise remove | Not an acquisition calculator; false workspace CTA removed on branch |
| Review Required | `/review-required` | Correct and approve flagged records | `ReviewRequired.tsx`, `items`, identification action | Partial | Implement | Check cross-niche access, mutation scoping, persistence and error handling |
| Audit | `/audit` | Real chronological audit events | `Audit.tsx`, `audit_log` with legacy `inventory` fallback | **Broken** | **Remove until audit ledger verified** | Fallback can present stock as audit evidence; misleading |
| Listings | `/listings` | Draft/listing overview | `Listings.tsx`, `listings` linked to `items` | Partial | Implement | Open/edit/save/publish safeguards and exact niche context unverified |
| Orders | `/orders` | View orders and fulfilment state | `Orders.tsx`, tenant-scoped `orders` linked to `items` | Partial | Implement | Count, status, empty/error, niche filter and order action unverified |
| Dispatch | `/dispatch` | Confirm dispatch with tracking | `Dispatch.tsx`, `orders`, `swish-ebay-post-order` | Partial | Implement | External order mutation should never be used merely to test navigation; verification requires a sanctioned test process |
| Repricing | `/repricing` | Reprice saved listings | `Repricing.tsx`, `listings` + shared service | Partial | Implement if saving and readback verified | No bulk repricing capability; disabled fake bulk action removed elsewhere |
| Insights | `/insights` | Actual stock/recorded sale/order metrics | **Candidate:** `Insights.tsx` + `insightsMetrics.ts` tenant+niche scoped paginated `items`/`orders`/`sales` | Candidate | Implement if live queries reconcile; otherwise remove | Prior version read only 100 rows and misordered dates; new version has pure regression tests but no authenticated readback yet |
| Money | `/money` | Ledger totals, fees, payouts | `Money.tsx`, top 500 `sales`/`orders` + 200 fees/100 payouts | **Broken** | **Remove until reconciled** | Fallback can mix revenue definitions, missing fees treated as zero, refresh omits sales and financial service |
| Tasks | `/tasks` | Manage real persistent tasks | `Tasks.tsx`, `tasks` table and CRUD | Partial | Implement | Saved, refresh/reopen and empty/error not browser verified |
| eBay Hub | `/ebay` | Surface supported eBay journeys | `EbayHub.tsx`, connector status, subordinate links | Partial | Implement after auditing every exposed target | Hub must not advertise removed subroutes |
| eBay Account health | `/ebay/account` | Verify seller connection | `EbayAccount.tsx`, `marketplace_connectors` | Partial | Implement | OAuth account binding, fresh first login, errors/reconnect not end-to-end proven |
| eBay Listings | `/ebay/listings` | See marketplace listings | `EbayListings.tsx`, `listings` | Partial | Implement | Cross-check external vs stored status and refresh |
| eBay Orders | `/ebay/orders` | Synchronise and view eBay orders | `EbayOrders.tsx`, `orders`, `swish-ebay-orders` | Partial | Implement | Sync error/empty/duplicates/permissions not live tested |
| eBay Messages | `/ebay/messages` | Read/respond to buyer messages | `EbayMessages.tsx`, `ebay_messages`, `swish-ebay-messages` | Partial | Implement if backend reply supported | Never imply a reply was sent without authoritative confirmation |
| eBay Offers | `/ebay/offers` | Inspect offers | `EbayOffers.tsx`, `ebay_offers` | Unknown | Implement if genuinely live read-only; otherwise remove | No successful real-data proof |
| eBay Returns | `/ebay/returns` | Sync and inspect return cases | `EbayReturns.tsx`, `ebay_returns`, `swish-ebay-post-order` | Partial, candidate | Implement read/sync only | Unsupported disabled 'Unavailable' action button removed on branch; sync not verified |
| eBay Cases | `/ebay/cases` | Monitor open disputes | `EbayCases.tsx`, `ebay_cases`, `swish-ebay-post-order` | Unknown | Implement or remove after action verification | Needs read/action evidence |
| eBay Finances | `/ebay/finances` | Accurate fee/payout information | `EbayFinances.tsx`, `ebay_financials` | Unknown | Implement only if reconciled; otherwise remove | Must not duplicate/contradict Money/Insights |
| eBay Analytics | `/ebay/analytics` | Report marketplace performance | `EbayAnalytics.tsx`, capped `sales`/`orders`/`listings` | **Broken/partial** | **Remove until shared analytics reconciled** | Separate/truncated totals can contradict Insights; no complete-run verification |
| eBay Import | `/ebay/import` | Import existing account stock | `EbayImport.tsx`, edge import routes | Partial | Implement | Must verify genuine imported item and scope without creating eBay sale |
| eBay Logs | `/ebay/logs` | Inspect real activity | `EbayLogs.tsx`, `ebay_logs`/`logs` | Unknown | Implement if current, else remove | Legacy alternate sources require checking |
| Settings | `/settings` | Profile/business/security, verified niche switch | `Settings.tsx`, `profiles` / auth / local Vector bridge | Partial | Implement tested options only | Notification toggles have no proven notification delivery; misleading 'Sign Out of All Devices' corrected to current device |
| Master Admin | `/master-admin` | Owner-only administration | `MasterAdmin.tsx`, verified owner role + subscription Edge Function | Partial, candidate | Implement verified functions only | Email-based privileged UI replaced by backend owner RPC; no subscriber grant backend, no fake controls |

## Direct routes, nested actions, and mobile/other navigation

| Display label / action | Route or action | Intended purpose | Source | Status | Decision | Verification needed |
|---|---|---|---|---|---|---|
| Home / niche entry aliases | `/`, `/coins`, `/mx`, `/bikes`, `/threads`, `/clothes`, `/surplus`, `/cards`, `/games`, `/antiques`, `/home`, `/fossils`, `/beauty`, `/tech`, `/electronics`, `/tunes`, `/tunes-flip`, `/tunes_flip`, `/music`, `/vinyl_records`, `/collectibles`, `/collectibles-flipper`, `/collectibles_flipper`, `/stamps`, `/stamp-flip`, `/stamp-flipper`, `/entry/stamps`, `/philately` | Enter authorized product | `App.tsx`, `productContext`, `AuthorizedModule` | Partial | Implement only recognized aliases | Test direct reload, entitlement, stale session |
| Workspace selector | `/niches` | Choose entitled niche | `NicheEntry.tsx`, `useNicheAccess` | Partial | Implement | Must ensure fresh server membership, switch and stock isolation; future-niche teaser removed |
| Workspace home / Quick List | `/workspace/:niche` | Niche-specific shortcuts and truthful counts | `NicheWorkspace.tsx`; `items` count + `listings` | Partial | Implement | Some CTAs mislabelled unrelated pages; corrected/removed on branch |
| Onboarding | `/onboarding` | Complete verified profile/connection/start | `Onboarding.tsx`, `profiles`, `auth`, `marketplace_connectors` | Partial | Implement | Local completed-step flags must reconcile to real backend; empty/failed accounts |
| Inventory create | `/inventory/new` | Save a real stock item | `InventoryNew.tsx`, `items` | Partial | Implement | Scoped insert then reload |
| Inventory details / legacy stock alias | `/inventory/:id`, `/stock-listing/:id` | Read/edit item | `InventoryItem.tsx`, `items` | Partial | Implement | Correct tenant/permission, persistence, controlled missing-ID state |
| Coin deep identify | `/identify/coins`, `/deep-id-lab` | Coin scanner | `App.tsx`, `Identify.tsx` | Partial | Implement as canonical scan alias or remove obsolete direct route | Prevent parallel divergent identification paths |
| Generic capture alias | `/capture`, `/antique-capture` | Open authorized scanner | `App.tsx`, `NicheCapture.tsx` | Partial | Implement authorized redirects | Direct link on wrong niche must not leak data |
| Music scanner | `/scan/tunes_flip` | Release-specific scan workflow | `TunesCapture.tsx` | Partial | Implement | Same eBay category and grade contract after save/reopen |
| New listing | `/listings/new` | Create persisted draft | `ListingNew.tsx`, `items` + `listings` RPC | Partial | Implement | Draft-only reversible tests; no live eBay publish without authorization |
| Listing details/editor | `/listings/:id`, `/listings/:id/edit` | Edit, save, reopen, preflight and submit | `ListingDetails.tsx`, `ListingEditor.tsx`, `listingEditorSave.ts` | Candidate | Implement | Branch preserves missing form category/condition IDs and canonical music grading; browser/preflight pending |
| Legacy eBay admin | `/ebay/admin` | Owner-only admin alias | `App.tsx` -> `MasterAdmin` | Partial | Implement with verified owner guard | Denied direct navigation |
| Category alias | `/ebay/categories` | Category selection | `App.tsx` -> `EbayHub` | **Broken** | **Remove misleading alias** | Wrong destination; no category workflow |
| CSV alias | `/ebay/csv` | Import CSV | `App.tsx` -> `EbayImport` | Unknown | Implement only if actual CSV controls exist, else remove | Validate input, rollback/duplicates |
| Draft sync test alias | `/ebay/draft-sync-test` | Test draft sync | `App.tsx` -> `EbayLogs` | **Broken** | **Remove misleading alias** | Logs are not draft sync |
| Tools: Islamic/silver batch | `/tools/islamic-batch`, `/tools/silver-batch` | Coin specialist processing | `SpecialistTools.tsx`, `swish-islamic-identify` | Unknown | Implement only if full evidence-to-save path; else remove | No verified batch persist/readback |
| Tools: bike flipper | `/tools/bike-flipper` | Specialist bike scan | `App.tsx` -> `/scan/bikes` | Partial | Implement redirect if supported | Confirm niche ID and access |
| Listing pre-flight | `/tools/listing-preflight` | Validate saved listing before eBay publish | `App.tsx` -> `Listings` | **Broken** | **Remove misleading alias** | Listings page is not preflight |
| Missing route | `*` / 404 | Controlled unavailable response | `NotFound.tsx` | Partial | Implement | No blank page, preserve authorization, clear recovery link |
| Desktop sidebar menus | Toggle eBay; open pages; workspace link; sign out | Accessible navigation | `Sidebar.tsx` | Partial | Implement | On branch toggle has aria-expanded and sign-out has aria-label; test keyboard and narrow view |
| Compact bottom navigation | Home, Inventory, Scan, Listings, More | Mobile route consistency | `NativeTabBar.tsx` | Partial | Implement | Remove/redirect target changes consistently; test narrow view |
| Host-specific navigation | Standalone menu + mobile | Product access | `AppLayout.tsx` | Partial | Implement | Verify subscribed niche and verified owner |
| Header Search | Search → `/inventory?q=...` | Find stock | `Header.tsx`, `Inventory.tsx` | Partial | Implement | Changing query while inventory mounted may not update local filter; keyboard/mouse, empty/error needed |
| Header action/menu controls | Search, navigation, sign-out, status icons | Functional controls | `Header.tsx`, `Sidebar.tsx`, `Settings.tsx` | Partial | Implement/remove every inert control | User interaction coverage required |
| Context menus, empty-state actions | Numerous page-specific links/buttons | Complete task after empty/error | `src/pages/*`, `src/components/features/*` | Unknown | Implement valid targets or remove | Full reachable control graph not exhaustively click-tested |
| Barcode camera and manual lookup | Barcode scanner | Capture real UPC/EAN/ISBN | `BarcodeCapture.tsx`, `barcodeDecoder.ts`, `useBarcodeLookup.ts` | Candidate | Implement native detection + visible manual fallback; restore tested portable decoder later | Missing ZXing deps blocked prior build; review branch now explicitly reports unsupported automatic decoding where BarcodeDetector absent |

## eBay draft contract — explicit preserve criteria

- Seller-selected category ID/name and condition ID should survive save/readback/reload even when an editor form hydrates incompletely. The review branch now prefers saved item values only when the category is unchanged.
- Vinyl Records category `176985` offers **New/Used** at category-condition level; media and sleeve have **separate** grades, including `VG+` = `Very Good Plus`. Other categories must load their own backend condition policy; a saved condition ID must not be carried across incompatible category changes.
- Any test of publication must use persisted draft and pre-flight operations, not `route: 'publish'` or a transaction, without explicit separate user authorisation.

## Current evidence log / release blocker ledger

1. Baseline `main` GitHub web verification run **44968682356**: **230 passed, six failed** in the shared flow suite; typecheck/build/lint originally skipped. Web review run **44968682359** also failed.
2. Review branch run **44983197390**: **235 passed, six failed**. Same six as baseline; added targeted tests passed, but no release approval.
3. Independent checks run **44983301885** discovered additional baseline compilation blockers: missing `@zxing/browser`/`@zxing/library`, stale barcode reading shape, mixed component types, saved-value type errors, and lint `no-useless-escape`. These have candidate corrections on the branch, with repeat CI required.
4. Source review run **44983197387** reports pinned native main has changed. Do **not** silently bump/pin/approve until native-to-web contract is reviewed. The native repo is **reference only**, no native code changes.
5. Authentication, populated/empty/error flows, direct routes, workspace switching, narrow viewport, eBay draft readback, and deployed site have **not** been interactively tested. **No final deploy to production `main`.**

## Mandatory next release gate

Reconcile every **Remove** decision in *all* route aliases, main navigation, mobile menus, workspace CTAs, command/search results and keyboard state. Correct **Implement** source paths, verify each with representative populated account, truly empty account, failed API response, refresh/reopen, wrong-tenant denial, narrow viewport and direct-link revisit. Run tests, TypeScript, lint, build, niche checks and native contract comparison. Only after green evidence merge/commit to `main`, wait for actual OnSpace sync completion and verify `swishflip.co.uk` signed-in workflows; record the exact commit and any remaining risk.

**Do not represent this work as complete or deployed while any line above is pending.**


## Implemented on review branch — source changes, not a production claim

| Web capability | Review-branch disposition |
|---|---|
| Legacy Dashboard | Sidebar entry removed; `/dashboard` redirects to current authorised workspace instead of presenting stale tenant totals |
| App Tools & Parity, Stock Check, Audit, Money, eBay Analytics | Entries removed from desktop navigation, eBay Hub where applicable, and direct routes resolve to controlled unavailable response |
| Misleading eBay Categories, draft-sync test, listing-preflight aliases | Controlled unavailable route instead of silently substituting an unrelated page |
| Unfinished Islamic/Silver batch tool | Removed workspace entry and direct batch routes: identification results were ephemeral, not saved with a recoverable inventory journey |
| Threads Flip pseudo-tabs | Decorative/inert Identify, Style and misdirected Value controls replaced by real Listings and Sales/Stock Insights links |
| Insights | Full paginated eBay sales/orders and stock reads scoped by signed-in tenant and specialist; hide invalid data instead of showing zero; date-sorted months; explicit refetch/error |
| Inventory | Full paginated items and listings rather than one server page. URL query synchronisation repaired for header search while Inventory remains open |
| Command Centre | Legacy inventory counts corrected to `items`, removed inactive batch actions and false backend-connected label, added activity retry |
| eBay Returns | Removed unsupported disabled action, retained bounded read/synchronisation paths |
| Settings | Unsupported notification toggles removed; saved options still require real-data readback tests. Sign-out label clarified |
| Admin/permissions | Privileged navigation and route UI now use verified backend `isPlatformOwner`; Master Admin niche list comes from `PRODUCTS`; unsupported subscriber grant teaser removed |
| eBay category, condition and music grading | Preserve saved IDs when draft form blank; when category changes, require a new compatible condition instead of reusing old ID; reopen respects explicit cleared condition; `Very Good Plus` canonicalises to `VG+` |
| Barcode | Native `BarcodeDetector` when browser supports it; explicit visible EAN/UPC/ISBN manual lookup where automatic decoder unavailable; no pretend software decoder |
| Legacy deep link fallback | Controlled explanation, workspace recovery link, and no console-error log on expected unavailable routes |
| Native/source parser | Rejected prototype-mutating keys in imported native configuration literal (security fix) |

**Review evidence:** GitHub Actions on the review branch have reported passing TypeScript, production build, lint, and niche mapping checks in completed intermediate runs. All added persistence/analytics tests passed; the shared regression suite had outdated scanner/category/decoder source expectations which were reviewed and updated to assert the actual supported journeys rather than bypassing the test runner. The current tip must receive its own clean CI result before any merge. The native contract drift gate remains independently blocked until its pinned reference is reconciled against native main.

**No authenticated live-browser / OnSpace production evidence exists for this branch.** These fixes remain candidates. The broader retained journeys (inventory mutations, membership switching, all eBay subsections, scan/identify, Acquisitions, Opportunities, Tasks, Settings, direct routes, error/empty, mobile) are *not* certified. Don't merge to `main` or deploy on the basis of source checks alone.
