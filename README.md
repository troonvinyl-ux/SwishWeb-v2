# SWISH Web v2

The responsive web client for SWISH's shared inventory, identification and eBay engine. Uses the existing OnSpace Cloud backend and shared user accounts.

## Development

Requires Node 20+ and npm.

```sh
npm ci
npm run dev
```

The backend URL is defined in `src/lib/supabase.ts`. An optional `VITE_SUPABASE_ANON_KEY` must be an existing public/anon key for that project. Never use service-role keys, AI keys, eBay credentials or Stripe secrets in this client.

## Verification

```sh
node --test scripts/test/*.test.mjs
npx tsc --noEmit -p tsconfig.app.json
npm run build
npm run lint
npm run test:niches
node scripts/verify-web-parity.mjs
```

Main pushes run the web checks and retain a verified `dist` artifact. This workflow does not deploy. The separate source-contract and reviewed-release workflows retain their evidence requirements; a green build does not prove live eBay or billing acceptance.

## Features

Public SWISH home, thirteen specialist workspaces, account onboarding, niche switching, photo identification, inventory, drafts and listing review, eBay seller operations, orders, dispatch and settings. Storage locations are suggested from saved workspace inventory. Suggested selling prices can be inserted at 5% below the available market valuation. Existing listing submissions are protected against blind client retries.

## Publishing

Use the existing OnSpace project and deployment settings. SPA hosts must route application paths to `index.html`; `public/_redirects` supplies this for compatible static hosts. Configure existing authentication callback URLs for the intended web origin. Do not create a replacement database or marketplace integration.

See `docs/production-readiness/2026-11-16-v2-recovery.md` for recovery details and remaining live acceptance requirements.
