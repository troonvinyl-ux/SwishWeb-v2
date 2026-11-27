# Coin envelope request and native packet compatibility

## Reported symptoms
- “Acquisition context is invalid or too long.” refers to input validation, not elapsed acquisition time.
- A ready coin can have no envelope transcription in the web queue even when the normal SWISH backend has returned native packet OCR.

## Concrete code changes
- The original identify and targeted envelope reread now use short acquisitionContext labels. Full instructions remain in knownAttributes.customNotes. Seller notes are not silently truncated; a local 30 KB known-attribute check mirrors SWISH shared/identificationPolicy.ts.
- The existing swish-identify endpoint, authenticated seller/tenant/niche scope, original photos, item ID, draft engine and publishing safeguards are retained. No provider, schema, alternate resolver or backend binding was added.
- Web evidence normalization consumes top-level coinPacket and persisted attributes._coin_packet using the main app’s transcript, quote, uncertainty and measurement-unit rules from shared/coinPacket.ts. Legacy collector_envelope responses remain supported.
- Literal country/date/ruler/denomination/metal notation from packet evidence can populate reviewable fields. Packet readings remain collector claims; paper measurements are not fresh seller measurements. Mint and hidden characters are never fabricated.
- Retained native OCR can be recovered without another paid identification. Only an explicitly rejected old acquisition-context reread permits one automatic retry for this request version. Ambiguous outcomes/timeouts are not automatically replayed.
- Missing OCR displays the actual saved read error and the existing Read envelope again action. Retry/resume continues on the original capture and inventory ID.

## Verification
Added/updated regression coverage: coin-envelope-transport, rapid-coin-preparation, collector-envelope-reread and collector-envelope-ui-contract.
Tests have not been executed in this tool-only session; no terminal/test-runner tool is available. Live Preview network inspection returned no requests. Production SWISH authentication and original images have not been tested here.
The builder Cloud database is separate from the authoritative SWISH runtime: items/listings are absent in the builder identity check. Its logs cannot verify the production request. Existing src/lib/supabase.ts SWISH binding is unchanged.

## Production acceptance
1. Retry the rejected capture using Retry same capture; verify short acquisitionContext with detailed customNotes and the same capture UUID.
2. Open the ready Leopold coin’s Identification evidence. If saved packet OCR is present, show its transcript without another identify call. If absent, use Read envelope again on the same saved envelope and both faces.
3. Confirm the returned transcript, source-labelled Hungarian identity and 1673 issue date versus separate reign dates; review denomination against both coin photographs.
4. Confirm envelope photos remain internal evidence and that reading/retrying never creates a second item, second draft or publication.

References checked during implementation: SWISH/main/shared/coinPacket.ts; supabase/functions/_shared/coinPacket.ts; shared/identificationPolicy.ts.
