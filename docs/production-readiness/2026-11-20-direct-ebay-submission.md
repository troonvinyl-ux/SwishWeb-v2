# Direct web eBay submission

## Change requested
Remove the additional web submission blockers and use the existing SWISH eBay service directly.

## Implemented
- One explicit **Submit to eBay** action saves dirty fields and calls `swish-ebay-list` with the same saved listing ID, original specialist niche, selected photos and sale format.
- Removed the editor's AI verification prerequisite, seller override step, mandatory conflict questionnaire, secondary publish confirmation and persistent browser retry reservation.
- Old `swish-publication:*` session keys are no longer read. They cannot prevent an explicit submission.
- Missing category/condition and AI confidence do not disable the web submit button. The existing backend resolves/validates eBay requirements and reports its response.
- An old `verified` status created by the removed verification flow is returned to `draft` only on explicit submission, with scoped compare-and-set filters and no existing claim or external ID. This matches the native publish claim migration's draft/pending/failed contract.
- A pending server claim is never cleared or expired in frontend code. Unchanged requests reach the shared service; dirty content is not saved over a pending submission.
- Recorded eBay IDs, sold/ended/live listings, workspace authorization, photo ownership and an in-flight click guard remain protected.
- Category suggestions can be reapplied with **Use category**; selections are included in the automatic save.

## Backend boundaries
The web client remains bound to the existing SWISH deployment in `src/lib/supabase.ts`. No backend URL, account, credential, database schema or server claim was changed. The editor RPC and metadata compatibility save remain in use.

## Regression coverage
Updated obsolete source assertions and added `scripts/test/direct-ebay-submission.test.mjs` for save-before-submit, verified-status recovery, preserved server claims, existing IDs, explicit retries, double clicks and concurrent claims/IDs.

## Verification still required
No command runner or authenticated seller session was available in this editing session. Regression execution, TypeScript/build checks and live seller acceptance remain pending. Run the existing Web build and lint GitHub workflow, then submit a test draft on the shared deployment. Genuine shared-service/eBay account or pending-claim rejections are not bypassed. No scan-to-live speed or successful live sale is claimed.
