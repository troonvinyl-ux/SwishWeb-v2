# Listing Studio browser enhancement — implementation and verification record

## Status
Browser camera enhancement implemented. This is NOT a claim that native Listing Studio V2 parity or production acceptance is complete.

GitHub API returned these latest main revisions during inspection:
- `troonvinyl-ux/SWISH`: `1450f9da723cc701d60db7b668d577fc3a29ee36`
- `troonvinyl-ux/SwishWeb-v2`: `57b1d4392fdfc3e9d4c2143884579ba2c17e3bb7`

The requested `docs/SWISH_LISTING_STUDIO_V2.md`, `hooks/useListingStudio.ts`, `services/listingStudioService.ts`, `_shared/listingStudio.ts` and `_shared/listingStudioObservation.ts` did not return retrievable content at current native main. A listing of the native feature directory was also inspected, but the tool truncates large responses. Do not claim that source absence has been conclusively proved. Obtain the actual merged revision or readable files before enabling the new observation contract. Source availability alone would still not prove deployment.

## Backend boundary
The existing browser singleton remains pinned to `https://iwgaqieyoahmcjfziwga.backend.onspace.ai`. Its key validator rejects expired, non-anonymous or wrong-project JWTs. `VITE_SUPABASE_URL` cannot override this constant. Authentication storage/session restoration and marketplace clients were not replaced.

The editor's available Cloud tools are bound to a DIFFERENT project (`wkcxmsmywyxsavhkwkcx`), containing only the platform profile table. No SQL, Edge Function deployment or key request was sent there. `.env` reading was denied by the tool; no environment variables were changed. A public metadata fetch against the requested SWISH backend returned no usable content. Network inspection returned no recorded Live Preview requests. None of this verifies production route deployment.

**Backend deployment revision actually verified: none.** There was no authorised SWISH browser session available to execute a `studio_observe` smoke test. The new route is not called or presented as verified. Interim observations use the pre-existing `swish-identify` request shape through the existing client, including module and tenant checks. Music uses its existing compact JSON request adapter. This fallback remains subject to connected-account testing.

## Delivered browser behavior
- `/studio/:niche` opens from explicit specialist workspace links; `/studio` is global capture with no required selection screen.
- Scanner shell suppresses normal application navigation. Existing capture dialogs use the same quieter surface.
- Small SWISH branding, close, niche selector where supported by the new session, capability-detected torch. No permanent research sidebar or zoom panel.
- Bottom guidance, compact processing text, horizontal original-photo strip and reachable gallery, shutter and Done.
- Charcoal translucent gradient/scrim with yellow accents. No visual mask enters capture, upload or AI images. Reduced transparency/motion fallbacks and safe-area/dynamic-viewport support are included.
- Retake, remove and reordering are available on demand in the new Studio intake. Existing music camera receives its real photos and keeps taking photos without closing after each shutter.
- Desktop drop import, rear-camera preference, existing camera selection/focus/zoom and permission fallbacks are reused. Controls are not shown for unsupported capabilities. The seller always triggers the shutter.
- Bounded analysis copies are cached per File and decoded sequentially. Observation requests are debounced, aborted on changes/unmount, timed out, payload-limited and rejected when their session generation is stale. AI latency does not lock the shutter.
- Temporary recovery is in memory only, user/tenant scoped, expires after two hours and clears on logout/account/tenant switching. No offline catalogue, credentials, browser inventory or new database is created. Reloading/closing the tab loses unsaved originals; this limitation is disclosed in Tools.
- A selector only affects an unsaved camera session. It cannot move any canonical saved item. Authorised module activation and current entitlement checks precede niche analysis and handoff.
- Done is available with one photo. Coins/music hand off originals to their existing specialist evidence/research screens; remaining evidence requirements stay visible. Other niches enter the existing shared Quick List engine and disclose missing views in draft review. Private incomplete drafts do not waive server publication requirements.
- Catalogue choices remain separate from camera inference. Music photo changes invalidate physical review without silently deleting the seller-selected Discogs reference. Measurements, condition and catalogue selection remain in the existing specialist review rather than a second camera-side schema.
- Existing item-images persistence, generator, canonical draft RPC, editor, price insertion, eBay OAuth/bindings, repair, publish confirmation and reconciliation remain authoritative. No production publication was attempted.
- A conservative guard around Quick List checks for an existing tenant/item draft and avoids automatically replaying uncertain item/draft inserts.

## Reused contracts/services
`supabase.ts`, `publicBackendKey.ts`, `niche.ts`, `sharedScanFlow.ts`, `nativeCaptureProfiles.ts`, `moduleScope.ts`, `captureRequest.ts`, `sharedScanPhotos.ts`, browser camera hooks, `musicIdentificationRequest.ts`, `musicApi.ts`, `useMusicResearch.ts`, `quickCaptureFlow.ts`, `capturePersistence.ts`, `swish_create_listing_draft`, and existing specialist and listing screens. Native capture/source pins now match the inspected main revision; review remains **pending**, not approved.

## Files added
- `src/types/listingStudio.ts`
- `src/lib/listingStudioSession.ts`, `listingStudioGuidance.ts`, `listingStudioPreparation.ts`
- `src/contexts/ListingStudioContext.tsx`
- `src/hooks/useStudioHandoff.ts`, `useStudioPhotos.ts`, `useStudioObservation.ts`
- `src/pages/ListingStudio.tsx`, `StudioReview.tsx`
- `src/components/features/StudioCameraSurface.tsx`, `StudioGuidanceCard.tsx`, `StudioPhotoRail.tsx`, `StudioToolSheet.tsx`, `StudioNicheSelector.tsx`, `StudioResearchNotes.tsx`, `listingStudio.css`
- `scripts/test/listing-studio.test.mjs`
- This completion record.

## Files modified
`src/App.tsx`; layout `AppLayout.tsx`, `Header.tsx`, `NativeTabBar.tsx`; pages `NicheWorkspace.tsx`, `Identify.tsx`, `TunesCapture.tsx`; feature `SharedCaptureCamera.tsx`, `QuickCaptureWorkspace.tsx`, `MusicEvidencePanel.tsx`; hooks `useCameraDialog.ts`, `useQuickCapture.ts`, `useMusicSession.ts`, `useMusicResearch.ts`; libraries `quickCaptureFlow.ts`, `sharedScanPhotos.ts`, `nativeCaptureProfiles.ts`; `src/types/capture.ts`; `config/swish-source.json`.

## Verification actually performed
- Read-only local source inspection and GitHub main/source fetches.
- Static implementation review only.
- Added regressions for scope/expiry, photo memory/order, conservative uncertain-save handling, original-photo isolation, existing route/client use and TypeScript syntax diagnostics.
- **Automated tests run: none.** This editing environment has no shell/test runner tool. Added tests are not represented as passing.
- **Build/typecheck/lint run: none.** Existing GitHub `web-verify.yml` already invokes the entire regression suite, TypeScript, Vite build and lint.
- **Browsers/devices tested: none.** No screenshot, mobile, landscape or published-app acceptance was executed.
- **GitHub commits/PRs created by this session: none.** Repository editing does not prove a push or commit.
- **Database changes: none.** No migrations or additional backend required for this browser implementation.

Run after committing through the existing GitHub integration:
```sh
node --test scripts/test/*.test.mjs
npx tsc --noEmit -p tsconfig.app.json
npm run build
npm run lint
```

## Remaining blockers and unverified cases
1. Retrieve and review the actual native Studio V2 source. Audit all named workspace/camera/guidance/tool/retention files and exact observation response schema.
2. Verify `studio_observe` on the established SWISH backend using an authenticated, currently entitled member. Record its actual deployed revision. Do not substitute this editor's different Cloud project.
3. Auto Detect currently allows immediate photography but does **not** claim an automatic cross-niche recommendation. Explicit authorised selection is required; its UI explains that recommendation awaits the shared Studio route. Do not invent a generic specialist authorization bypass.
4. Guidance currently combines existing shared capture roles and returned legacy missing-information text; the complete native evidence-driven observation model is not ported or certified.
5. Coins retain existing Numista/measurement and face checks in their specialist review. Done with incomplete evidence opens that review, not an unsupported guaranteed draft. This session did not sync all earlier evidence-led coin changes from GitHub or relax marketplace/authenticity gates.
6. Music/coin catalogue tools remain primarily in the existing review workflow; camera Tools provides notes, catalogue entry links and capability-based camera controls, not a duplicate enrichment engine.
7. Confirm coin, music and tech end-to-end on the connected backend; test slower AI, permissions, gallery decode errors, reordering, context changes and interrupted sessions. Legacy specialised pages' full acceptance remains pending.
8. Test Safari/iOS, Android Chrome, desktop browsers, landscape/tablet, keyboard/focus and OnSpace iframe restrictions. Repeat on the published HTTPS site.
9. Verify seller-approved publishing, pending/failed presentation and accepted-but-unconfirmed safe recovery only with explicit test consent. No live listing is needed for camera acceptance.

## Release/rollback
This is a web-only deployment; no native or server rollout has been performed. First require existing CI and browser acceptance. Roll back the coordinated web change set if the new intake fails, retaining the existing `/scan/*` specialised routes. Do not roll back shared data, credentials or production marketplace state. Enable the audited native Studio route only in a subsequent reviewed integration once source and deployment blockers are resolved.
