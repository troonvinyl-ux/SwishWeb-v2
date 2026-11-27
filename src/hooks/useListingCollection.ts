import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useTable } from '@/hooks/useSupabaseQuery';
import { useCurrentTenantId } from '@/hooks/useCurrentTenantId';
import { getActiveNicheId, getSpecialistIdsForNiche } from '@/lib/niche';
import { LISTING_TABS, listingTab } from '@/lib/listingPresentation';
import { describeBackendFailure } from '@/lib/backendAvailability';
export function useListingCollection() {
  const tenant = useCurrentTenantId(), nicheId = getActiveNicheId(), [params, setParams] = useSearchParams();
  const tab = LISTING_TABS.find(entry => entry.id === params.get('tab'))?.id || 'all', search = params.get('search') || '';
  const query = useTable('listings', { select: '*, items!inner(*)', allPages: true,
    order: { column: 'created_at', ascending: false }, filter: { tenant_id: tenant.tenantId, marketplace_id: 'ebay' },
    inFilter: { 'items.specialist_id': getSpecialistIdsForNiche(nicheId), 'items.tenant_id': tenant.tenantId ? [tenant.tenantId] : [] }, enabled: Boolean(tenant.tenantId) });
  const rows = useMemo(() => {
    const data = query.data || [];
    const liveItems = new Set(data.filter(row => listingTab(row) === 'live' && /^\d{6,20}$/.test(String(row.external_listing_id || ''))).map(row => String(row.item_id)));
    return data.filter(row => listingTab(row) !== 'draft' || !liveItems.has(String(row.item_id)));
  }, [query.data]);
  const counts = useMemo(() => Object.fromEntries(LISTING_TABS.map(entry => [entry.id, entry.id === 'all' ? rows.length : rows.filter(row => listingTab(row) === entry.id).length])), [rows]);
  const visible = useMemo(() => rows.filter(row => (tab === 'all' || listingTab(row) === tab) && `${row.title || ''} ${row.external_listing_id || ''}`.toLowerCase().includes(search.toLowerCase().trim())), [rows, tab, search]);
  const change = (key: string, value: string) => { const next = new URLSearchParams(params); if (value && value !== 'all') next.set(key, value); else next.delete(key); setParams(next, { replace: true }); };
  const refresh = async () => { const result = tenant.tenantId ? await query.refetch() : await tenant.refetch(); if (result.error) toast.error(describeBackendFailure(result.error)); else toast.success('Saved listings refreshed. No eBay listing was submitted.'); };
  return { visible, counts, tab, search, change, refresh, tenantId: tenant.tenantId, nicheId, loading: tenant.isLoading || query.isLoading, refreshing: query.isFetching, error: tenant.error || query.error };
}
