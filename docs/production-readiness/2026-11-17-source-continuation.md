# SWISH web continuation — member eBay scope

## Source update

The native baseline now records `troonvinyl-ux/SWISH@fab5c890e9186150de221753c5d5d7c232cb39ab`. The source advanced twelve commits beyond the prior web candidate. The relevant behavioural change is a request-local member eBay scope for `swish-ebay-list` and `swish-ebay-listing-status`.

Seller-side requests must now retain all of the following server-verified facts:

- a current authenticated member session;
- the member's authorized tenant and active niche module;
- a valid, live eBay account binding for that member and tenant.

Public category taxonomy calls remain deliberately unbound to a seller account. They still execute only under the current server-established module scope. The web client must not select, create, or infer an eBay binding from a tenant or niche identifier.

## Web alignment in this candidate

- Scoped category lookup already verifies the active module before each request and after the result is returned.
- The listing editor now verifies the active module before it reserves a tab-local non-repeatable publish attempt.
- Publication retains its explicit confirmation and uncertain-attempt guard. The backend remains authoritative for session liveness, account identity and binding lease checks.

## Still required before acceptance

- Redeploy the affected existing Edge Functions and their shared dependencies in the existing OnSpace project; this web change does not perform that deployment.
- Verify authenticated category lookup, listing-status recovery and an authorized seller flow against the current deployed backend.
- Obtain non-author owner review of the final web source-sync change. The source pin is intentionally `pending`; it is not release evidence or approval.
