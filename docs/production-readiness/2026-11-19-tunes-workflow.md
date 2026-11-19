# Tunes Flipper web integration delivery register — 19 November 2026

## Status and scope

The web capture-to-inventory/draft implementation has been extended against the existing SWISH contracts. This is **not a production acceptance sign-off**. No terminal, browser-driving tool or authenticated SWISH production test session was available to run the acceptance scenarios, a build or a confirmed live listing. The sub-60-second target is not claimed.

Authoritative source inspected: `troonvinyl-ux/SWISH`, commit `08af3947840d119f4813965784953fd77ce2a53a`. Existing client backend: `https://iwgaqieyoahmcjfziwga.backend.onspace.ai`. The editor's separate `wkcxmsmywyxsavhkwkcx` Cloud was not used to deploy functions, store secrets or create tables. Finding code in GitHub does not prove its live deployment/configuration.

## 1. Existing components and services reused

- Existing AuthProvider, current tenant lookup, AuthorizedModule and `verifyModuleScope`/`assertCaptureScope` membership checks. No second Supabase client or authentication flow.
- SharedCaptureCamera, device camera/library fallback, zoom/focus capability handling, CapturePhotoRail and barcode normalization.
- Existing bounded `prepareScanPhotos` analysis copies; `persistCapturePhotos`, item-images storage and unchanged canonical items/listings.
- `swish-identify`, `swish-discogs`, `swish-market-value`, `swish-list-generate`, `swish_create_listing_draft`.
- Existing listing editor, category suggestion, `swish-verify`, explicit PublishConfirmation, publication-attempt guard and `swish-ebay-list`.
- Existing seller binding, shipping/business rules, Simple Delivery, order/status sync, More/niche navigation, subscriptions and reporting. No new Stripe/eBay OAuth, marketplace connectors or database schema.

## 2. Implemented or fixed

- `/scan/tunes_flip` loads a dedicated, lazily loaded workflow; the existing generic capture screen redirects music aliases to this route after its access checks.
- Automatic debounced photo recognition, editable provenance-labelled fields, bounded catalogue lookup, individual-release selection, separate media/sleeve grades and factual draft copy.
- Shared inventory-only saving and eBay-draft generation/readback. Saving cannot publish.
- Original photos and entered details remain in the active capture after recognition, catalogue, pricing or save errors. Once a write begins its snapshot/ID is locked for recovery rather than silently changing an uncertain mutation.
- Duplicate inventory prevention uses a fixed client-generated item ID and scoped readback. An uncertain draft creation is checked by readback and is never automatically replayed.
- A lazy ZXing software decoder now supplements native BarcodeDetector for video snapshots and selected barcode images, without acquiring a second video stream.
- A seller-selected centre crop/rotation can improve small-identifier analysis. It is a separate local analysis copy; original storage/listing photos are unchanged. No synthetic text or image enhancement is introduced.

## 3. Twelve-photo progressive capture

All twelve slots are optional: front cover, rear cover, barcode, spine, Side A label, Side B label, Side A runout, Side B runout, inner sleeve/booklet, extra printed identifiers, edition details and condition/contents. CD, cassette and box-set labels adapt to the format.

One photo can start recognition. Upload multiple photos, select a particular evidence view, retake/replace it or remove it. The display reads “N of 12 photos”; there is no twelve-photo completion gate. Useful follow-up text is returned by recognition and/or the ambiguity check. A sole usable release asks for physical confirmation, not a compulsory series of extra photographs.

SWISH's existing identification policy permits eight analysis images, 800,000 characters per image and a 6 MB request. Twelve originals therefore use at most eight and then four analysis copies, carrying previously observed/user details into the next call. The originals are uploaded individually to Storage, not encoded in the database. New/removed evidence clears stale non-user catalogue/AI fields before collective reanalysis; seller edits survive.

Automatic calls are debounced, not quota-free. Large/HEIC or unsupported browser images may still need JPEG/PNG replacement. Capture/browser permissions and actual macro focus remain device-dependent.

## 4. Discogs matching and metadata

- Valid checksum-normalized UPC/EAN takes priority. Otherwise search the catalogue number, then artist/title, then reliable text.
- Catalogue spacing and punctuation normalize for comparison; an empty catalogue search can retry a punctuation-stripped term once. O/0 and similar ambiguous characters are **not** silently rewritten.
- Search always uses `type=release` through the existing server-side gateway. Master IDs are never accepted as the matched item.
- Rank artist/title, catalogue, label, media format, country and year. Retrieve the three best first-page candidates, then compare their returned barcode and matrix/runout identifiers with observed evidence.
- Matrix comparison is conservative, normalized exact identifier comparison. Partial, unknown or missing matrix data does not certify a pressing. A barcode alone never silently confirms an edition.
- Show individual release ID/link, label, catalogue, format, country/year, agreement score, mismatches and available distinguishing matrices. Scores are a heuristic agreement indicator, not calibrated probabilities. Seller confirmation is always required; manual release selection is explicitly labelled.
- Authorized gateway calls remain server-side. React Query caches are keyed by user/tenant and bounded to the gateway's six-hour freshness policy; scope is checked on cached readback too.
- Artist, release title, labels, catalogue numbers, barcode when unambiguous, year/country, formats, genre/styles, permitted identifiers and catalogue tracklisting/durations populate the review. Actual disc count remains seller-entered; catalogue disc count is recorded separately as expected contents.
- Data provenance stays separate: Discogs metadata, photo-extracted suggestions, AI inference and seller input. Lower-confidence AI cannot replace catalogue facts or seller edits. A field confidence absent from the response is “not supplied”, not an invented numeric confidence.

**Existing gateway limits:** first 20 search results, three detailed candidates, at most 60 identifiers and 150 tracks. This is not an exhaustive pressing search. Plant/mastering clues only participate where present in catalogue identifiers and readable evidence. Comparing seller photos with Discogs catalogue images is not implemented because this gateway explicitly excludes catalogue images. Notes, credits, marketplace data and private collections are deliberately excluded by its authorised public catalogue contract. No unsupported data or invented Discogs reference is substituted.

## 5. AI quick-sale valuation and one-tap pricing

The action uses the **existing** `swish-market-value` engine with selected release metadata, seller grades/condition and the UK quick-sale instruction in its supplied attributes. No new model/provider endpoint or parallel price database is deployed. The live engine's exact handling of custom instruction text remains unverified.

The panel shows estimated market value, SWISH quick-sale price and suggested minimum offer, with returned confidence, rationale and uncertainty. A returned relevant sold count, verified count and usable sold median are required before labelling the estimate sold-supported. Active asking prices are context, not completed transactions. Without comparisons the UI says AI-only estimate.

For a sold-supported estimate the client quick-sale adjustment is capped at 92.5% of the returned market estimate or the lower existing recommendation. The optional minimum offer is explicitly a transparent 90%-of-quick-price heuristic, **not** a separately verified AI valuation. No sale-time guarantee or fabricated completed sale is shown. Missing/invalid market values produce an error rather than an invented price.

The tick adjacent to the eBay price applies the quick-sale value immediately; price remains editable. The shared listing editor also exposes the same saved recommendation and can refresh it through SWISH without back-navigation. Best Offer is not automatically enabled and its minimum is not forced onto the seller.

## 6. eBay listing population and shared handoff

Draft title: artist, release title, format, year, label/catalogue and supported edition details, bounded to 80 characters. Automatic copy updates avoid overwriting a seller-edited title/description. A provisional identification remains disclosed.

Mapped specifics where known and within supported length: Artist, Release Title, Record Label, Format, Genre, Style, Release Year, Speed, Record Size, Edition, Features, Catalog Number, UPC/EAN, Record Grading and Sleeve Grading. Format/type details also remain in canonical music attributes for the existing server mapper. Oversized aspect values are omitted rather than silently truncated; server category checks still require completion.

Release country is **not** asserted as country of manufacture. Description includes release details, permitted real tracklisting, separate grades, visible flaws/contents, seller-observed matrices and the selected catalogue reference. Play-tested language appears only after explicit seller confirmation. Catalogue photos never replace seller photographs.

The canonical draft RPC receives reviewed copy/specifics and the entered price. Category/required aspects remain handled by the existing editor/taxonomy and preflight, not guessed category IDs. Users can edit shared music fields in the editor with tenant/specialist/version guards; item changes invalidate listing verification. No live eBay submission occurs before the existing final confirmation.

## 7. Tests, results and timings

### Actually executed in this session

- File/source inspection and code modifications only.
- **No automated test suite, TypeScript typecheck, production build, desktop/mobile capture, authorised Discogs lookup or live eBay listing was executed.**
- **No end-to-end timing was measured in this development session.**

### Added, not executed

`music-workflow.test.mjs`: synthetic barcode-first, catalogue normalization, shared barcode, matrix variants, artwork/text fallback, release/master/freshness, CD/cassette views, damaged-packaging/missing fields, provenance protection, sold-supported and AI-only pricing, safe copy, image limits/crop preservation, scoped draft contracts, software decoder and syntax guards.

`music-persistence.test.mjs`: deterministic fake-client inventory/draft path, original-photo handoff, draft readback, idempotent recovery, lost-response recovery without replay, partial photo failure, changed scope, review and photo-limit guards. These are **contract tests**, not real-device, RLS or production end-to-end evidence.

The existing CI already runs `node --test scripts/test/*.test.mjs`, typecheck, build, lint and niche mapping. No release evidence has been marked passed.

| Requested acceptance scenario | Production/browser result |
| --- | --- |
| Modern vinyl, readable barcode | Not run |
| Vinyl with catalogue number, no barcode | Not run |
| Two pressings sharing barcode | Not run |
| Same catalogue, different matrices | Not run |
| Older vinyl from labels/artwork | Not run |
| Ambiguous release requiring confirmation | Not run |
| CD barcode | Not run |
| Cassette without barcode | Not run |
| Damaged/incomplete packaging | Not run |
| Pricing with supported comparisons | Not run |
| Pricing without verified comparisons | Not run |
| Capture → inventory → draft → confirmed live listing | Not run |
| Other SWISH niches regression, mobile and desktop | Not run |

Runtime instrumentation records actual first-photo-added → saved inventory/photo attachment or saved draft readback duration. The result is labelled in the shared price area and console as **not live publication**. Recognition/catalogue passes show their own elapsed time separately. None of these values is prefilled, fabricated or treated as acceptance evidence.

## 8. Remaining owner actions and limitations

1. Confirm `swish-discogs` and the inspected shared services are deployed on the original SWISH backend, not this editor's separate Cloud.
2. Configure/verify `DISCOGS_CONSUMER_KEY`, `DISCOGS_CONSUMER_SECRET`, `DISCOGS_USER_AGENT` only in that original deployment. Commercial use requires the gateway's owner-reviewed `DISCOGS_COMMERCIAL_USE_APPROVED=true` permission; owner evaluation does not grant commercial authorisation. Never put these in VITE/browser variables.
3. Tunes Flip's integration-status details include server-authorised owner-only configuration and read-only health buttons. They do not reveal secret values or switch user accounts. They were not clicked/tested here.
4. Run the entire CI gate. During source inspection, `src/components/ui/button.tsx` could not be read although pre-existing shared files import it. Resolve/restore existing read-only shared UI/import gaps through the original project before a verified build. No read-only UI file was modified, and existing regression checks were not weakened.
5. Run all twelve scenarios with an authorised seller, Discogs permission, desktop Chrome/Firefox/Safari and mobile Safari/Chrome. Check actual populated category aspects, item condition mapping, Simple Delivery and account binding. Capture failures must retain progress and no test may publish without explicit confirmation.
6. Test draft/save recovery and two-user isolation against real RLS and edge authorisation; fake-client tests do not prove those boundaries.
7. Test one owner-approved low-risk live listing through existing confirmation and inspect actual eBay status/account afterward. Do not auto-retry unknown publication results.
8. Record real timings and failures, including capture/focus, catalogue rate limits and pricing availability. Do not mark the requested production success criterion satisfied until this evidence exists.

The requested full production completion and end-to-end verification therefore remain open. This delivery is integrated application code plus explicit verification gates, not a claim that untested external services or a live listing succeeded.
