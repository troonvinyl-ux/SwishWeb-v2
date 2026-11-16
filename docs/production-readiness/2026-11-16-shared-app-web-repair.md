# Shared SWISH app and website repair — 16 November 2026

Authoritative source branches are troonvinyl-ux/SWISH main for the app and backend, and troonvinyl-ux/SwishWeb-v2 main for the website. Both keep the existing OnSpace Cloud backend and shared accounts.

Native candidate: 4d620bb6ad7c0d1918286fadce3b13a2c74e4471. The web source-contract snapshot records this exact main revision and its root tree IDs, with release approval still pending. This is source alignment, not production acceptance.

The app backend now establishes request-local member context after module authorization and its listing/status handlers use the member-scoped clients. Taxonomy does not inherit a seller binding. The website category screens verify the active signed-in account and module before dispatch and after receiving a suggestion, send the niche assertion to the server, and discard stale responses. Existing Tunes music-only category filtering remains in place.

The web build/check run for d7d2310cdb7c5a5aed68b9f16ef80f61350a80f7 passed: https://github.com/troonvinyl-ux/SwishWeb-v2/actions/runs/43952253141. Native scope tests and full handler type checks are tracked by the eBay member request scope workflow. Live OnSpace deployment, real-account seller binding and publication acceptance are not claimed by these repository checks.

A GitHub web build does not deploy OnSpace Edge Functions. Redeploy swish-ebay-list and swish-ebay-listing-status in the existing OnSpace project with the updated shared dependencies, then verify category lookup and saved listing/status behavior against the same account and niche. No new database, marketplace account or backend project is created by this repair.
