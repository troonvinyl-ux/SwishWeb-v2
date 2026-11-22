# Native SWISH main source review — 22 November 2026

**Web target:** `troonvinyl-ux/SwishWeb-v2` (not native `SWISH` and not the legacy `SwishWeb` repository). **Branch:** `audit/web-menu-data-integrity-20261122`, [draft PR #3](https://github.com/troonvinyl-ux/SwishWeb-v2/pull/3). **Production:** `main` remains unchanged and automatically syncs with OnSpace if merged; this review is **NOT** a production deployment or full-parity approval.

## Source evidence

| Attribute | Inspected result |
|---|---|
| Previous native pin | `fab5c890e9186150de221753c5d5d7c232cb39ab` |
| Inspected native main | `bb3634f6c531851c49b03b21a5731f48809fa9c0` |
| Comparison | [44 commits and 50 changed files](https://github.com/troonvinyl-ux/SWISH/compare/fab5c890e9186150de221753c5d5d7c232cb39ab...bb3634f6c531851c49b03b21a5731f48809fa9c0) |
| Snapshot | All 20 tracked native root entries checked against the inspected native commit's complete, untruncated top-level tree |
| Changed tracked roots | `app`, `services`, `contexts`, `hooks`, `shared`, `supabase`, `.github`, `scripts`, `app.config.js`, `components` |
| Unchanged tracked roots | `constants`, `template`, `niches`, `niche-modules.json`, `package.json`, `assets`, `app.json`, `eas.json`, `pnpm-lock.yaml`, `release` |
| Existing OnSpace backend | `https://iwgaqieyoahmcjfziwga.backend.onspace.ai`; no new backend/DB created or authorised |
| Native CI | Several native GitHub checks were green at `bb3634f6c531`: niche standardisation/isolation, Universal Quick List, shared Smart Studio, Tunes source/secret boundaries, canonical photo persistence, S2–S3 foundation acceptance. **These are not web-browser acceptance tests.** |

## Actual workflow impact and action

| Affected workflow | Native diff examined | Web implementation/review decision | Outstanding acceptance |
|---|---|---|---|
| Shared accounts/tenant/niche | `contexts/TunesContext.tsx`, changed `hooks`/shared source; no observed native auth schema migration in 50-file comparison | Existing backend identity/tenant-scoped web calls retained; no native auth implementation copied | Wrong-tenant denial, entitlements and account switching in deployed browser |
| Inventory and published-status reconciliation | `app/stock-listing/[id].tsx` adds status-only reconciliation with existing `reconcileListingPublication` and re-fetches saved item. Already-verified ended listings move out of Live | Existing web listings and inventory remain separate read-only/source-of-truth queries. No live marketplace status mutation introduced | Confirm ended/sold statuses and refreshed stock counts with real linked listings |
| Capture/identification/photo persistence | Android camera mount, focus/session guards, barcode/manual fallback, device-camera fallback; `shared/specialistIntelligence.ts` Tunes copy and evidence policy changed; native `constants` and registry unchanged | `CAPTURE_SOURCE_COMMIT` in `nativeCaptureProfiles.ts` aligned with the new tracked native pin; test asserts exact match. Native camera implementation is **not** ported into Vite/browser. Existing server-side secure photo save remains | Browser-permitted camera, retry/unavailable states, permanent original photos and readback, no stale session reuse |
| Tunes Flip Discogs release selection | `shared/musicRelease.ts`, `services/musicCaptureService.ts`, `contexts/TunesContext.tsx` now distinguish seller-selected **closest** individual release from physically verified pressing; `discogs_pressing_confirmed` remains false | Web `MusicMatches` already labels releases "Seller selected" and warns of physical pressing uncertainty. No automatic pressing-certification introduced. Preserve separate media/sleeve grades | Actual Discogs selection, details save/reopen, edition/matrix review, and honest provenance on draft |
| eBay category and conditions | Native `hooks/useListingEditor.ts`, `services/listingAutofillService.ts`, `services/preparedListingService.ts`, `services/quickListService.ts` now use recorded media grade and live category-policy choices. `supabase/functions/swish-ebay-list/index.ts` can map a missing saved music eBay condition ID from media grade *only against a live policy*, and persists it. It returns a controlled not-submitted response when no valid mapping exists | Web draft save retains existing category + matching condition; changing category clears incompatible old IDs, retains media/sleeve grades separately; VG+/Very Good Plus canonicalised. No test eBay publish performed | Confirm effective deployed Edge Function revision, category-specific conditions, exact persisted IDs, separate grades, reversible preflight and reopen |
| Orders/fulfilment | New status-only eBay recovery reads external listing status; Android tooling changes do not establish web dispatch parity | Web order/dispatch code unchanged as part of source-pin update | Existing connector/tenant/readback and status/error recovery |
| Billing/subscriptions | No direct billing/Stripe source diff in these 50 files; `supabase` root still changed from eBay listing function | No billing endpoint invented, existing Stripe checkout HTTPS browser-return gap remains | Browser checkout/portal callback evidence and owner verification |
| Release tooling | Changes to Expo OTA/runtime fingerprint, CI mirrors and APK signing/testing workflows; native assets/package/backend root identity unchanged in tracked entries | These are native APK/OTA mechanics, **not** permission to change the web build/update pipeline. Web review source guard unchanged and still fails on future native drift | Independent web build/lint and protected OnSpace publication |

## Source pin, review authority and release boundary

1. `config/swish-source.json` now records the inspected native main full SHA plus exact Git tree SHAs for all 20 tracked roots. Status remains `"pending"`, `reviewUrl: null`. **Recording an inspected SHA is not a parity approval.**
2. Web runtime `CAPTURE_SOURCE_COMMIT` now refers to the *same* native revision; regression test rejects mismatches.
3. Web source-review verification previously trusted PR URLs from the **wrong repository** `troonvinyl-ux/SwishWeb`. It now requires `troonvinyl-ux/SwishWeb-v2`. The security invariants remain: merged PR to that repository's main, GitHub owner **APPROVED** review on final PR head, no self-review, no stale/dismissed approval, no change requests, and exact reviewed `config/swish-source.json` snapshot.
4. `scripts/check-web-release.mjs` now actually calls the read-only GitHub approval verifier rather than trusting a local `approved` string/URL. It fails closed if the token or GitHub review cannot be verified.
5. [Draft PR #3](https://github.com/troonvinyl-ux/SwishWeb-v2/pull/3) is **owner-authored** (`troonvinyl-ux`). The owner-review policy explicitly forbids this owner from approving their own PR. For final approval, create/merge a **non-owner-authored** reviewed source-sync PR under current owner rules, or change approval authority through an explicit separately reviewed policy decision. Do **not** set `review.status = "approved"` on this draft or spoof an owner review.
6. The source-contract CI job checks baseline alignment, **not** production readiness. It can pass with a legitimate *pending* aligned pin; `scripts/check-web-release.mjs` and the protected web release candidate still refuse production while owner-approval/live-evidence conditions are unmet.
7. Previously reported web digest `08b8d21fbb9a188df410789ea42f5b5f6511c464298e90ebb027cbff8e0cdfb6` is an output fingerprint of the previous web tree, **not the cause of the native-source drift failure**. Every file change on this review branch changes the digest. Never reuse that digest as acceptance evidence.

## Known gaps / release risks

- Need read-only live OnSpace backend identity and actual deployed Edge Function revision checks; source changes alone do not imply backend deployment.
- Need account-based browser journeys: normal data, empty account, 401/403/503, persistent reads after refresh, direct links, narrow/mobile navigation, workspace switching.
- Need eBay category/condition/media grade/sleeve grade persisted save/reopen evidence. Ordinary testing must not create an eBay listing or transaction.
- Need current Discogs selection/pressing semantics confirmed in production for Tunes Flip.
- Need full web release evidence for the *current* web digest and native commit, including billing/OAuth and dispatch. `docs/production-readiness/web-release-evidence.json` remains intentionally incomplete.
- The full SWISH native-main compare is broad; root-level drift in 10 trees maps conservatively to all eight source-impact workflow groups. Web build/tests do not eliminate the need for authorisation and live acceptance.

**Verdict: Reviewed the native diff sufficiently to record an exact, pending source candidate and web capture reference. No release approval, native modification, main merge, OnSpace publication or eBay transaction.**
