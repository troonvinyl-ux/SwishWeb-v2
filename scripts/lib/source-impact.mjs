export const WORKFLOWS = [
  { id: 'accounts', label: 'Shared accounts and onboarding', native: ['template/', 'contexts/', 'hooks/useApp', 'services/auth', 'app/login', 'app/onboarding', 'components/auth'], web: ['src/contexts/AuthContext.tsx', 'src/pages/LoginPage.tsx', 'src/pages/Onboarding.tsx', 'src/hooks/useCurrentTenantId.ts'], checks: ['shared_accounts', 'registration_verification', 'tenant_isolation'] },
  { id: 'inventory', label: 'Inventory and niche ownership', native: ['constants/', 'niches/', 'niche-modules.json', 'app/stock', 'app/inventory', 'services/item', 'services/inventory', 'shared/'], web: ['src/lib/niche.ts', 'src/pages/InventoryItem.tsx', 'src/pages/StockCheck.tsx'], checks: ['inventory_save_reopen', 'niche_isolation'] },
  { id: 'capture', label: 'Capture, identification and permanent photos', native: ['app/capture', 'app/identify', 'app/deep-id', 'services/capture', 'services/nicheCapture', 'services/quickList', 'hooks/useQuickList', 'shared/specialistIntelligence', 'shared/nichePolicy', 'constants/specialists', 'services/photo', 'shared/smartStudio', 'components/feature/', 'supabase/'], web: ['src/pages/NicheCapture.tsx', 'src/components/features/QuickCaptureWorkspace.tsx', 'src/lib/nativeCaptureProfiles.ts', 'src/lib/quickCaptureFlow.ts', 'src/lib/sharedScanPhotos.ts', 'src/pages/Identify.tsx'], checks: ['photo_persistence', 'native_workflow_parity'] },
  { id: 'listings', label: 'Draft, specifics, preflight and publication recovery', native: ['app/listing', 'app/create-listing', 'services/listing', 'services/verification', 'hooks/usePublication', 'hooks/useAntiquePreflight', 'components/feature/', 'supabase/'], web: ['src/pages/ListingEditor.tsx', 'src/lib/listingReadiness.ts', 'src/hooks/usePublicationAttempt.ts'], checks: ['listing_specifics_save_reopen', 'listing_preflight_publish', 'ebay_sync_recovery'] },
  { id: 'marketplace', label: 'eBay consent, seller data and uncertain sync', native: ['app/ebay', 'services/ebay', 'supabase/'], web: ['src/pages/EbayHub.tsx', 'src/hooks/useEbayOAuthRecovery.ts', 'src/hooks/useEbayHubActions.ts'], checks: ['ebay_oauth_return', 'ebay_sync_recovery', 'tenant_isolation'] },
  { id: 'fulfilment', label: 'Orders, dispatch and money', native: ['app/orders', 'app/dispatch', 'app/money', 'services/order', 'services/fulfil', 'supabase/'], web: ['src/pages/Orders.tsx', 'src/pages/Dispatch.tsx', 'src/pages/Money.tsx'], checks: ['orders_dispatch', 'niche_isolation'] },
  { id: 'billing', label: 'Existing Stripe ownership and niche entitlements', native: ['services/subscription', 'app/subscription', 'supabase/', 'constants/niches'], web: ['src/pages/NicheEntry.tsx', 'src/pages/NicheWorkspace.tsx'], checks: ['stripe_web_return', 'shared_accounts'] },
  { id: 'release', label: 'Branding, runtime and reviewed releases', native: ['assets/', 'app.config.js', 'app.json', 'eas.json', 'package.json', 'pnpm-lock.yaml', '.github/', 'scripts/', 'release/'], web: ['config/swish-source.json', '.github/workflows/', 'src/lib/productContext.ts'], checks: ['web_build_lint', 'native_workflow_parity', 'same_backend_identity'] },
];
function touches(prefix, changed) {
  const left = prefix.replace(/\/$/, '');
  const right = changed.replace(/\/$/, '');
  return left === right || prefix.startsWith(`${right}/`) || changed.startsWith(prefix);
}
export function workflowImpact(drift, files = []) {
  const paths = [...new Set([...drift.map(change => change.path), ...files.map(file => file.filename)])];
  return WORKFLOWS.filter(flow => flow.native.some(prefix => paths.some(path => touches(prefix, path))));
}
export function impactMarkdown(report) {
  return `## SWISH source update review\nPinned: ${report.pinnedCommit}\nObserved main: ${report.latestCommit}\n[Compare changes](${report.compareUrl})\n\n${report.drift.length ? report.drift.map(change => `- Changed contract: ${change.path}`).join('\n') : 'No tracked contract changes.'}\n\n${report.impacts.map(flow => `### ${flow.label}\nWeb review: ${flow.web.map(path => `\`${path}\``).join(', ')}\nRequired evidence: ${flow.checks.join(', ')}`).join('\n\n')}\n\nChanged-file listing is informational and may be truncated by GitHub; whole contract trees remain the conservative review boundary. No update is merged, approved or deployed by this check.\n`;
}
