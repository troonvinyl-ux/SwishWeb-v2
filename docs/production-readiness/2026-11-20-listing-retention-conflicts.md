# Category/condition retention and confirm-to-amend flow

## Shared deployment retained

The web client remains bound to the existing SWISH deployment at `iwgaqieyoahmcjfziwga.backend.onspace.ai`. No new database, credentials, tables, marketplace connections or deployment binding were created. OnSpace diagnostic tools could not access this deployment's eBay function logs; the Live Preview network buffer was empty. No authenticated seller records were queried by tools in this session.

## Root causes and corrections

- Independent listing/item refetches could hydrate category and condition from an older item row after save. Loading now waits for matching canonical stock; saved listing and item readbacks are installed into the exact React Query caches before any subsequent hydration. Dirty seller edits survive background refreshes.
- The source app's `20261030_editor_disconnect_storage.sql` RPC stores `ebay_item_specifics` as an array of name/value rows. Capture historically stored a map. The editor now normalizes both formats rather than discarding array specifics.
- Some existing editor RPC versions ignore newer condition-ID, condition-notes, photo-selection and listing-options keys. The existing authorized item update path retains this metadata using a version-conditioned update of the same stock row, preserving other attributes and original photos. Category/condition/text readback mismatches fail visibly rather than reporting success or clearing the edits.
- Hydration uses the item's persisted category reference as a fallback and retains category name, condition, condition ID and notes together.
- Music-specific editing no longer overwrites a selected eBay condition with a media/sleeve summary.

## Seller correction workflow

The review surface presents deterministic questions for conflicting media/sleeve grades, unsupported play-testing claims and incomplete tracklisting. A seller chooses which grade or playback statement is correct, or supplies corrected text. Answers update only labelled facts, the corresponding shared music evidence and required draft text. Track restoration uses saved catalogue tracks and does not invent songs.

`Use this answer & recheck` saves the same existing listing and stock item through the existing RPC and reruns `swish-verify`. It does not create another draft, dispatch eBay publication, manufacture playback findings, confirm a pressing, or automatically invoke a human override. AI confidence remains advisory. Genuine account, policy, taxonomy, stock and safety requirements remain enforced.

`Save & check` combines two previously separate actions. Verification is tied to the exact current draft revision, including the stock version. Publication still requires explicit confirmation. Confirmed service rejections may release the browser reservation only after fresh scoped readback proves there is no listing or pending claim. Unknown outcomes remain locked.

## 69-second target

A session-scoped timestamp begins when the first photo is added. It is linked to the saved listing, survives scan-to-editor navigation and retries, and finishes only after the same eBay ID and active status are confirmed through the shared status-only endpoint. The editor shows elapsed time versus the 69-second target. Legacy drafts without a timestamp display no invented elapsed time. Human review and external service latency are included; 69 seconds is a target, not a verified guarantee.

## Regression coverage and release gates

Added deterministic tests for late stock hydration, dirty-edit preservation, matching tenant protection, array/map specifics, legacy RPC metadata retention, repeated saves, grade-specific correction, playback evidence, full saved tracks and timing lifecycle. The existing GitHub verification workflow already discovers these tests and runs TypeScript checking, build and lint.

Tests and build were not executable through this editor's available tools. Require a passing CI run plus live mobile acceptance before release: select category and condition, save and reopen; resolve VG versus VG+; choose actual playback status; restore an omitted track; confirm eBay publish on the same draft; confirm active status and record the measured first-photo-to-live time. Also test a genuine eBay rejection and an uncertain/network-failed publish to verify duplicate protection. No live listing was published in this development session.
