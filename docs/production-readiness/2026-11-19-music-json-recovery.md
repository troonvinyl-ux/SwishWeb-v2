# Tunes Flip invalid identification JSON recovery

## Evidence and boundary

The supplied production screenshot reports `swish-identify` returning HTTP 422 with `OnSpace AI: returned invalid identification JSON`. This is a server/provider response failure, not the earlier unsupported capture mode and not a browser layout error. A rejected server response does not expose usable identification JSON to the browser; the client cannot reconstruct or repair the missing response safely.

The web client remains bound to the original SWISH deployment, `https://iwgaqieyoahmcjfziwga.backend.onspace.ai`. Its accounts, tenant checks, models, photos, inventory and listings are unchanged. No schema, secrets or functions were installed on the editor's different Cloud project. The editor log tool could not retrieve the original `swish-identify` logs, and Live Preview had no recorded failed network requests. The screenshot is the production evidence available for this change.

Public shared source inspected: `supabase/functions/_shared/identificationPolicy.ts` and the specialist profile in the SWISH source repository. The parser requires a complete JSON object. The music guard uses scalar specialist fields, including `matrix` and `damage_notes`; UI aliases such as `matrix_runout` and `condition_notes` are not the corresponding server names. Source inspection does not confirm the deployed version or establish why that provider response was malformed.

## Client changes

- Request the existing SWISH response schema explicitly in the supported `knownAttributes.customNotes` context. Use concise scalar observations, no prose or Markdown, no tracklist/valuation expansion, and no fabricated IDs or playback grades. No unsupported model or provider configuration parameters are sent.
- Map existing UI observations to the actual specialist names. Do not feed storage location or visual-inferred grades into the photo instructions. Map returned `damage_notes` into the editable condition field.
- Preserve the structured EdgeFunctionError rather than flattening away its status and function name.
- On the exact `swish-identify` 422 invalid-identification-JSON failure only, retry once with the same analysis photos, labels, tenant, niche and a more explicit compact-response instruction. The recovery budget is one for the whole recognition run, not one per batch. It remains inside the existing 85-second client cancellation window.
- Do not retry authentication, entitlement, quota, photo-validation, network, provider-500, catalogue or writing operations. Both requests enforce the existing module scope and cancellation checks.
- Apply successful analysis batches progressively. If a later batch fails, already returned details stay available for editing. Seller edits and original photos are never replaced with the malformed response.
- Distinguish a Discogs lookup failure from an identification failure. A catalogue outage keeps the successfully recognised photo fields and offers the existing manual search.
- After unsuccessful recovery, identify it as a shared-service failure, preserve the evidence and keep the manual barcode/artist/title/release-ID path available. Never label a failure as success.

## Verification status

Added synthetic regression cases for recovery success, two malformed responses, one budget across twelve photos, matching evidence/scope, cancellation, workspace changes, non-retriable errors, progressive field delivery and specialist aliases. The existing CI discovers these with `node --test scripts/test/*.test.mjs`.

No terminal/test runner or authenticated browser automation is available in this session. Tests, typecheck and build were not executed here. No successful live AI response, mobile-device recognition or production release is claimed. Compact prompting is a client mitigation, not proof that the shared server's parser/provider fault is resolved.

## If production still returns 422

The original SWISH deployment owner must inspect and patch the original `swish-identify` provider/JSON boundary, not deploy a replacement on the editor Cloud. Check the provider's response content shape, finish reason and response length without logging photos, credentials or raw user content. Ensure the existing model's supported structured-JSON output is used, and that text is extracted from supported content parts before the existing parser. Treat truncated output as a failure; never fabricate missing JSON values, a release ID, identity or condition. Any bounded server recovery must remain within provider timeout/quota rules and should replace, not multiply, this client recovery budget after verification.

Retest on the original backend with cover-only, CD/vinyl, multiple-photo and deliberately unreadable fixtures, and verify scope isolation. Do not mark production recognition fixed until a valid populated response is observed in that deployment. No backend model was changed by this client update.
