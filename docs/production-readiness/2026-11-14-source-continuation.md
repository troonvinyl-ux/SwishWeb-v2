# SWISH web continuation: reviewed updates and safer listing inspection

## Inspection, not approval

Native main observed on 2026-11-14: `b5151e5a6f07a25c9016dccbdd18fff15dc5f96f` (`fix: restore Deno verification contracts`), immediately following the previous pin. The source candidate is recorded as **pending**, not approved. The observed native change includes PNG dependency and backend barcode/verification implementation fixes; no web callback rollout was verified. Backend, account, Stripe and eBay authority remain the existing SWISH project. No backend resources or native repository files were provisioned or deployed in this pass.

The source snapshot now also covers `components`, `assets`, `app.json`, `eas.json`, `pnpm-lock.yaml` and `release`. Changes to native shared feature components and packaged assets must not escape cross-client review merely because route/service tree IDs did not change.

## Browser workflow improvements

- Draft readiness displays title, description, finite price, permanent photo URL selection, saved-field state, item availability and tenant/specialist scope using already loaded records. Category, condition, required specifics and delivery are explicitly review-required, not invented live validation.
- The existing `swish-verify` call is labeled advisory verification, matching native `verificationService.ts`. A passed advisory result is not eBay acceptance.
- Native `listingPublicationService.ts` and `listing-preflight.tsx` prevent re-submitting a saved eBay ID, a server publication claim or an already active/live listing. Equivalent local guards now disable draft publication and saving for those records.
- A user/tenant/listing-scoped **tab-local** start timestamp is persisted before publication. An uncertain response or reload does not automatically clear it or allow replay. Storage-denied sessions cannot start an untracked request. This is additional browser protection, not a global marketplace lock or server claim.
- “Check saved status” only invokes the editor's existing read/refetch. It does not contact eBay reconciliation or repeat publication. A confirmed numeric eBay ID links to the existing listing. Missing saved evidence remains uncertain and requires investigation through the existing eBay logs/operations.
- Arbitrary manual status selection no longer represents a real marketplace publication. The saved status is shown as read-only in the draft editor.

## Reviewed update loop

`check-swish-source.mjs` emits JSON plus a readable impact report mapping changed native contract roots and available filenames to affected web modules and acceptance checks. Entire tree changes conservatively require review even when GitHub truncates a compare file listing. PRs, main pushes, schedules and optional `swish-source-updated` dispatch all compare the real remote main; dispatch payloads are not trusted as source pins. No auto-merge, backend migration or deploy occurs.

The source-sync PR template lists authority, workflow, regression and evidence obligations. The release check now reads the actual SwishWeb PR and review history: the PR must be merged into main, owner approval must cover its latest commit and must not be self-review, and the source snapshot in that reviewed commit must match the release candidate. A local `approved` flag/URL alone cannot pass. API access failure, stale/dismissed approval and changed baselines fail closed.

Required permissions: native repository contents read; web repository contents and pull requests read. Owner-authored source-pin PRs need to be submitted by a collaborator/automation so the configured owner can perform a non-author approval; changing the configured reviewer requires a separately reviewed policy change. Branch rules and protected production environment remain operator configuration, not established by these files.

## Remaining blockers

- This editor has no verified existing OnSpace Cloud binding; no new backend integration was implemented here.
- Existing Stripe checkout/portal native callbacks require a separately reviewed native-backend HTTPS return change before web billing can be accepted.
- Full saved photo order/options/specifics parity, live leaf-category/condition validation, status reconciliation, and all native workflows remain incomplete or unverified.
- Tab-local metadata does not coordinate other browsers/devices; shared backend claims and authorization remain authoritative. There is deliberately no “retry anyway” button for uncertain submissions.
- Existing editor photo edits/uploads and unsaved field workflows still require live persistence acceptance and further modularisation.

No build, typecheck, tests, live accounts, eBay mutation, Stripe checkout, remote PR review or production publishing was executed in this editor. Added automated regressions must run in CI/local tooling; release evidence remains blocked with no fabricated passing results.
