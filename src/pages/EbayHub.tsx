import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { callEdgeFunction, getSupabaseClientAsync } from '@/lib/supabase';
import { RefreshCw, CheckCircle2, AlertCircle, Link2 } from 'lucide-react';
import { useTable } from '@/hooks/useSupabaseQuery';
import { useCurrentTenantId } from '@/hooks/useCurrentTenantId';
import { useEbayHubActions } from '@/hooks/useEbayHubActions';
import EbaySyncStatus from '@/components/features/EbaySyncStatus';
import { formatDateTime } from '@/lib/utils';
import { readEbayConnector, ebayConnectorHeading } from '@/types/marketplace';

const QUICK_LINKS = [
  { to: '/ebay/account', label: 'Account health' }, { to: '/ebay/listings', label: 'Listings' },
  { to: '/ebay/orders', label: 'Orders' }, { to: '/ebay/messages', label: 'Messages' },
  { to: '/ebay/offers', label: 'Offers' }, { to: '/ebay/returns', label: 'Returns' },
  { to: '/ebay/cases', label: 'Cases' }, { to: '/ebay/finances', label: 'Finances' },
  { to: '/ebay/import', label: 'Import' },
  { to: '/ebay/logs', label: 'Logs' },
];
export default function EbayHub() {
  const { tenantId, isLoading: tenantLoading, error: tenantError } = useCurrentTenantId();
  const query = useTable('marketplace_connectors', {
    select: 'status,seller_account_id,access_token_expires_at,connected_at,last_sync_at',
    filter: { tenant_id: tenantId, marketplace_id: 'ebay' }, enabled: Boolean(tenantId), limit: 1,
  });
  const { connect, sync, connecting, syncing, syncError, syncProgress } = useEbayHubActions(tenantId);
  const account = readEbayConnector(query.data?.[0]);
  const [checkingSeller, setCheckingSeller] = useState(false);
  const [sellerError, setSellerError] = useState('');
  const verifyLinkedSeller = async () => {
    if (!tenantId || checkingSeller || connecting || syncing) return;
    setCheckingSeller(true); setSellerError('');
    try {
      const client = await getSupabaseClientAsync();
      if (!client) throw new Error('SWISH is not connected.');
      const result = await callEdgeFunction<{ success?: boolean; verified?: boolean; sellerAccountId?: string }>(
        'swish-ebay-oauth', { action: 'verify_connected_identity', tenantId }, client,
      );
      if (result.error) throw result.error;
      const name = result.data?.sellerAccountId;
      if (result.data?.success !== true || result.data.verified !== true || typeof name !== 'string' || !name.trim()) {
        throw new Error('eBay did not confirm a verified seller identity. The existing connection was not replaced.');
      }
      const fresh = await query.refetch();
      if (fresh.error || readEbayConnector(fresh.data?.[0])?.seller_account_id !== name) {
        throw new Error('eBay identity was verified but saved account readback is not confirmed. Reload account health before repeating.');
      }
      toast.success('eBay seller identity verified and saved. No reconnection was needed.');
    } catch (reason) {
      setSellerError(reason instanceof Error ? reason.message : 'Seller identity verification unavailable.');
    } finally { setCheckingSeller(false); }
  };
  const isConnected = account?.status === 'connected';
  const tokenExpiry = account?.access_token_expires_at;
  const tokenExpired = Boolean(tokenExpiry && new Date(tokenExpiry) <= new Date());
  const error = tenantError || query.error;
  const loading = tenantLoading || (Boolean(tenantId) && query.isLoading);
  return <div className="max-w-6xl space-y-6">
    <header className="swish-card border-primary/30 p-6"><p className="text-sm font-semibold uppercase tracking-widest text-primary">SWISH / SHARED MARKETPLACE</p><h1 className="page-title mt-2">eBay Hub</h1><p className="mt-3 leading-7 text-muted-foreground">Manage your existing shared eBay seller connection. Sync checks the active specialist’s listings using the app’s bounded batch flow. After eBay confirms authorisation, return to this web tab; SWISH verifies the connector rather than assuming consent.</p></header>
    {error && <div role="alert" className="flex items-center gap-3 rounded-xl border border-destructive/40 p-4 text-destructive"><AlertCircle className="h-5 w-5" /><span>{error.message}</span></div>}
    <section className="swish-card p-6">{loading ? <p role="status" className="text-muted-foreground">Loading account…</p> : <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">{isConnected && !tokenExpired ? <CheckCircle2 className="h-6 w-6 text-success" /> : <AlertCircle className="h-6 w-6 text-muted-foreground" />}<div><h2 className="text-lg font-semibold">{ebayConnectorHeading(account, Boolean(tenantId), Boolean(error))}</h2><p className="mt-1 text-sm text-muted-foreground">{error ? 'Refresh account health before reconnecting.' : tokenExpired ? 'Access token expired — sync will use existing refresh consent; re-authorise only if eBay requests it.' : isConnected ? tokenExpiry ? `Token valid until ${formatDateTime(tokenExpiry)}` : 'Connected' : 'Connect your existing seller account to enable marketplace features.'}</p>{isConnected && !account?.seller_account_id?.trim() && <p role="note" className="mt-1 text-sm text-warning">The shared eBay connector is authorised but has not recorded the seller account identity. Do not reconnect solely to fix this label.</p>}</div></div>
      <div className="flex flex-wrap gap-2">{isConnected && !account?.seller_account_id?.trim() && <button type="button" className="btn-secondary min-h-11 disabled:opacity-50" disabled={checkingSeller || syncing || connecting} onClick={() => void verifyLinkedSeller()}>{checkingSeller ? 'Verifying seller…' : 'Verify seller ID'}</button>}<button type="button" onClick={() => void query.refetch()} disabled={!tenantId || query.isFetching || connecting || syncing} className="btn-secondary min-h-11 disabled:opacity-50">Refresh status</button>{isConnected && <button type="button" onClick={() => void sync()} disabled={syncing || connecting || !tenantId} className="btn-primary min-h-11 disabled:opacity-50"><RefreshCw className="h-4 w-4" />{syncing ? 'Syncing…' : 'Sync now'}</button>}<button type="button" onClick={() => void connect()} disabled={connecting || syncing || tenantLoading || !tenantId} className={`${isConnected ? 'btn-secondary' : 'btn-primary'} min-h-11 disabled:opacity-50`}><Link2 className="h-4 w-4" />{connecting ? 'Checking authorisation…' : isConnected ? 'Re-authorise' : 'Connect eBay'}</button></div>
    </div>}</section>
    {sellerError && <p role="alert" className="flex items-center gap-2 text-destructive"><AlertCircle className="h-4 w-4" />{sellerError}</p>}
    <EbaySyncStatus busy={syncing} progress={syncProgress} error={syncError} />
    <section><h2 className="mb-4 text-lg font-semibold">Seller workspace</h2><nav aria-label="eBay sections" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{QUICK_LINKS.map(link => <Link key={link.to} to={link.to} className="swish-card flex min-h-14 items-center p-4 font-medium hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{link.label}</Link>)}</nav></section>
    {account && !error && <aside className="swish-card p-6"><h2 className="text-lg font-semibold">Account details</h2><dl className="mt-4 grid gap-4 sm:grid-cols-3">{[['Status', account.status], ['Connected', account.connected_at ? formatDateTime(account.connected_at) : 'Not recorded'], ['Last sync', account.last_sync_at ? formatDateTime(account.last_sync_at) : 'Not recorded']].map(([label, value]) => <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>)}</dl></aside>}
  </div>;
}
