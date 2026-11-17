# Mobile camera, barcode and Numista web correction

Source: troonvinyl-ux/SWISH, reviewed native capture contract at 52e7a44af940e6d684b241b914ec470853072791. Relevant files: SharedCaptureCamera.tsx, useQuickListCamera.ts, barcodeLookupService.ts, quickList.ts, numistaImagePreparationService.ts, numistaImageSearch.ts, quickListService.ts, theme.ts.

## Changes
- One browser camera stream in both inline and full-screen presentation. Callback ref reattaches the same stream after changing presentation. Original captured resolution is retained; camera stops on unmount, camera switch and backgrounding.
- Full-screen camera starts expanded like the native camera. Explicit Enable camera respects browser permissions. Native Library, shutter, Review, evidence count, framing grid, device selection, hardware zoom and torch where supported. Full-screen portal avoids transformed shell clipping; dialog keyboard focus and Escape are supported. Mobile safe areas and landscape layouts are handled.
- Barcode decoding uses local snapshots of that same video, as the native app's web fallback does. All native GTIN formats and UPC-E expansion/checksums are supported. A validated read triggers one existing swish-ebay-browse barcode_lookup request automatically. Normal undecodable frames are not errors. Manual entry and local barcode photo decoding remain available. Product and edition selection stays explicit; physical photos are required.
- Numista N# input accepts a positive identifier or the approved catalogue coin URL. Manual references remain seller references, not certification. Up to two original resized coin faces accompany identification in the native Numista image-search structure. Existing swish-identify and listing draft RPCs are reused; no new backend, credentials, catalogue database or AI provider is introduced.
- The selected reference is retained with source labeling in item attributes and shown through draft review and the linked saved-item/listing screens. Live image-search candidates are transient and never become offline catalogue copies or listing photographs.
- Next and List/Save terminology is retained. List continues to existing marketplace verification/publication controls; no automatic publication bypass is added.

## Acceptance still required
The builder has no device camera, terminal test runner or authenticated marketplace test capability. The added Node regressions must be run in web-verify CI, and actual barcode scanning, Numista provider responses, iOS Safari, Android Chrome, USB microscope, denied permissions, interrupted network, original-photo save/reopen and listing publication must be verified manually before release. The project-wide parity evidence is not marked passed by these code changes.

Numista number-only catalogue lookup is not assumed: the native function tree has no standalone Numista lookup Edge Function. This correction uses the existing photo identification/reference path. Catalogue-only import would need the exact approved source contract; no endpoint has been invented.
