# Web niche entitlement correction — 17 November 2026

## Report and cause

An all-niche member was shown only Coins and Antiques. The web selector, workspace and capture pages inferred membership from `tenants.active_specialists`. That field represents configured inventory specialists, not the user's verified subscription entitlements. A workspace with only those specialists configured could therefore hide other entitled products, even after successful server module activation.

## Source-aligned correction

The existing native `services/moduleAccessService.ts` and `services/subscriptionService.ts` use authenticated `swish-check-subscription({ tenantId })` and its canonical `niche_entitlements` response. This contract is present in reviewed source candidate `fab5c890e9186150de221753c5d5d7c232cb39ab` and was checked against main during this repair.

The website now shares that membership check through `useNicheAccess`, keyed by signed-in user and primary tenant. It sends the user's JWT, rejects results after an account change, and represents only registered product IDs. All-niche premium semantics are computed by the existing backend; the browser does not infer them from an email, username, editable metadata, specialist settings or local storage. Trusted owner status comes from the function response or the existing owner RPC for older deployments.

The selector, specialist workspace and both capture pages consume the same verified memberships. Refresh access is available in the selector, and membership failures are visible with retry controls rather than appearing as a smaller list. Existing `AuthorizedModule` activation and server readback remain in place; viewing an included niche is not a replacement for server authorization. Inventory specialist filters are unchanged.

No backend URL, database, account grant, subscription tier, Stripe integration or Edge Function is changed or created by this client repair.

## Verification and remaining acceptance

Regression coverage: `scripts/test/niche-access.test.mjs`, included by the existing web workflow's `node --test scripts/test/*.test.mjs` command. Cases cover thirteen-niche responses despite limited specialist configuration, partial memberships, malformed responses, unknown IDs, role fallback, account changes and denied authorization.

The editing environment did not expose a test runner, and its live preview returned no network requests. Test execution and the reported member's live grants have not been verified in this session. Run the web checks, sign in as the affected member, open SWISH Verticals and refresh access, then open previously hidden niches and their scanners. If the deployed subscription function returns only Coins and Antiques, investigate that account's grants and the existing SWISH function deployment; do not create client-side grants to mask the server response.
