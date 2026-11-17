# SWISH Main App ↔ Web parity register

This is the working parity register for `troonvinyl-ux/SWISH` (Expo main app) and `troonvinyl-ux/SwishWeb` (React/Vite web client). The target is functional parity, not merely matching page names.

## Guardrails

- Reuse the existing OnSpace/Supabase backend, tenant model, tables, storage buckets and deployed Edge Functions.
- Do not create a second database, invent backend endpoints, or report success when a server operation fails.
- All item-linked reads and writes must be tenant-scoped and niche-scoped wherever the main app scopes them.
- Marketplace secrets and access/refresh tokens remain server-only. Browser code may call existing Edge Functions but must not access credentials directly.
- Keep Simple Delivery as the default; do not introduce eBay shipping business policies or calculated shipping.
- Do not auto-confirm uncertain identifications or auto-publish drafts without an explicit user action.

## Source-of-truth review — 2026-11-14

- Source candidate pinned to `troonvinyl-ux/SWISH@b5151e5a6f07a25c9016dccbdd18fff15dc5f96f` in `config/swish-source.json`; owner review remains pending.
- Native eBay callback source and this web client reference the same backend URL. Deployed runtime identity and this editor's OnSpace Cloud binding are **not yet verified**; no new backend, Stripe account or native repository change was created.
- Source-derived frontend corrections: shared twelve-product login branding and PIN normalization, tenant-scoped connector onboarding, explicit listing verification/confirmation and canonical publishing tenant, account/niche cache reset, foreground polling and OAuth return recovery metadata.
- `/ebay/account` now has its own native-equivalent health/capability surface rather than pointing to generic Settings. Live parity acceptance remains pending.
- Native checkout and customer-portal return URLs are app schemes only. Web billing callbacks require a separately reviewed source-backend change; inventing web callback payload fields is prohibited.
- Scheduled/PR source-drift checks, static regressions, Code Owner declarations and an evidence-gated build candidate workflow were added. GitHub branch/environment protections and OnSpace publishing permissions require operator configuration; files alone do not enforce them.
- No live auth/eBay/Stripe tests or build commands were executed in this editor. A source match or route test is not full workflow parity. The checked-in release evidence deliberately blocks publication.

See `docs/production-readiness/SWISH-WEB-SOURCE-AND-RELEASE.md` for exact source contracts, remaining blockers, review steps and publishing boundaries.

Continuation details are in `docs/production-readiness/2026-11-14-source-continuation.md`: shared component/asset/build roots are now tracked, changes produce workflow impact reports, and the release check verifies actual merged owner review of the source baseline. Local labels do not approve a release. No backend resources or live acceptance results were created.

## Current implementation pass

| Main app capability | Web status in this branch | Notes |
|---|---|---|
| Authentication, tenant workspace and niche entry | Existing | Existing AuthContext, workspace routing and niche context retained. |
| Inventory browse/detail/create | Existing | Existing web inventory pages retained; niche scoping requires regression tests. |
| Single-item capture/identification | Existing | Uses existing identify/value Edge Functions and review/confirmation flow. |
| Islamic/Indian silver and countermark batch identification | Implemented in this pass | New batch screen invokes existing `swish-islamic-identify` sequentially, supports obverse/reverse images and measurements, shows server results/errors. It does not auto-confirm or publish. |
| Silver rapid-capture commercial workflow | Partial | Web batch identification is available; native batch lifecycle, commercial grouping, valuation strategy, batch resume/save and bulk listing still require parity implementation. |
| Bike Flipper | Partial | Web route opens bicycle capture; repair cost/profit decision engine and native buying recommendation flow still require implementation. |
| Listing creation/editor and item specifics | Existing | Existing web listing editor retained; regression tests must verify item specifics save/reopen and eBay revise. |
| Listing preflight and publication inspection | Partial / frontend safety improved | Draft readiness and advisory verification are explicit. Existing eBay IDs/server claims and tab-local uncertain attempts block repeat draft publication; saved-status inspection never resubmits. Live category/condition/specifics checks, photo/options persistence and backend reconciliation remain incomplete or unverified. |
| Orders and dispatch | Existing | Web pages exist; every native fulfilment state and transition needs verification against the same backend fields. |
| Repricing, insights, money, tasks, acquisitions, opportunities, review-required, audit | Existing | Pages exist; calculation and niche isolation parity tests remain required. |
| eBay hub, listings, orders, messages, offers, returns, cases, finances, analytics, import, logs | Existing | Pages exist; verify each route against the current server Edge Functions and native behaviour. |
| eBay account connection/admin/category admin/CSV tools | Partial / audit needed | Account health/capabilities now have a dedicated source-aligned web page. Subscriber OAuth uses the existing server action; browser return and live connector checks remain unverified. Admin/category/CSV native action parity still needs audit. |
| Stock check / stock listing workflows | Partial | Added a tenant- and niche-scoped stock check table with checkboxes, editable quantity/unit price, checked-stock summary, and save confirmation. The stock listing detail is routed to existing inventory detail; native-specific workflow parity still needs tests. |
| Deep ID lab, image enhancement, coin flipper commercial score, MX profit tools, surplus auction bid engine, niche-specific home actions | Gap / audit needed | Need function-by-function review of native screens/services before declaring parity. |
| Master admin and subscription | Existing UI / web billing blocked | Server owner/tenant rules remain authoritative. Native-only Stripe return URLs, complete subscription checks and browser callback acceptance must be reviewed before web billing parity can be claimed. |

## Next required work

1. Finish stock-check parity tests and port any remaining stock-listing-specific actions.
2. Port native listing preflight with the same checks and the existing server verification functions.
3. Port Silver Batch persistence/resume, commercial decisions, groups and bulk listing using the existing services/tables/functions.
4. Port Bike Flipper and motocross/surplus commercial decision screens using the existing decision engines and real data.
5. Complete the eBay account/admin/category/CSV action map and make every web action call an existing confirmed Edge Function.
6. Compare each native service and route against web behaviour, then add route, tenant-isolation, save/reopen, error-state and build/lint tests.

## Acceptance criteria for claiming full parity

- Every production main-app screen/function has a web destination and equivalent working action, or is explicitly excluded with a product decision.
- No placeholder route is represented as a completed feature.
- Reads/writes use the correct tenant and active niche.
- Edge Function failures and missing endpoints are visible; no mocked success.
- Save/reopen and eBay submission tests pass for listings and item specifics.
- Web production build and lint pass, and route smoke tests cover all parity destinations.
