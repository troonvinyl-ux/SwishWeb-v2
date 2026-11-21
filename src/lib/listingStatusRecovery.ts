import type { SupabaseClient } from '@supabase/supabase-js';
import { callEdgeFunction } from '@/lib/supabase';
import { activateModuleScope } from '@/lib/moduleScope';
interface StatusRecoveryInput { client: SupabaseClient; userId: string; tenantId: string; nicheId: string; listingId: string; }

function joinedItem(listing: Record<string, unknown>): Record<string, unknown> | null {
  const relation = listing.items;
  if (Array.isArray(relation)) return relation[0] && typeof relation[0] === 'object' ? relation[0] as Record<string, unknown> : null;
  return relation && typeof relation === 'object' ? relation as Record<string, unknown> : null;
}

/** A live listing is not reconciled until its canonical stock also leaves Draft. */
function assertInventoryReconciled(listing: Record<string, unknown>) {
  if (String(listing.status || '').toLowerCase() !== 'active') return;
  const item = joinedItem(listing), itemStatus = String(item?.status || '').toLowerCase();
  if (!item || item?.sold_at || !['listed', 'active'].includes(itemStatus)) {
    throw new Error('eBay confirms this listing is live, but SWISH stock still has not moved to Live. Do not submit again; use Refresh status to reconcile the existing listing.');
  }
}

/** Same status-only endpoint as the native app; never submits a new eBay listing. */
export async function checkSharedListingStatus({ client, userId, tenantId, nicheId, listingId }: StatusRecoveryInput): Promise<Record<string, unknown>> {
  await activateModuleScope(client, userId, tenantId, nicheId);
  const read = async () => {
    const response = await client.from('listings').select('*, items!inner(tenant_id,status,sold_at)').eq('id', listingId).eq('tenant_id', tenantId).eq('marketplace_id', 'ebay').eq('items.tenant_id', tenantId).single();
    if (response.error || !response.data) throw new Error(response.error?.message || 'The saved listing could not be checked.');
    return response.data as Record<string, unknown>;
  };
  const listing = await read();
  if (!/^\d+$/.test(String(listing.external_listing_id || ''))) return listing;
  const { data, error } = await callEdgeFunction<Record<string, unknown>>('swish-ebay-listing-status', { tenantId, nicheId, listingIds: [listingId] }, client);
  if (error) throw error;
  const observed = Array.isArray(data?.results) ? data.results.find((row: Record<string, unknown>) => row.listingId === listingId) as Record<string, unknown> | undefined : undefined;
  if (data?.success !== true || observed?.error || !['active', 'sold', 'ended'].includes(String(observed?.status))) throw new Error(String(observed?.error || data?.error || 'eBay did not confirm the existing listing status. Nothing was resent.'));
  const fresh = await read();
  if (fresh.external_listing_id !== listing.external_listing_id || fresh.status !== observed?.status) throw new Error('eBay was checked but saved status still needs review. Do not republish.');
  assertInventoryReconciled(fresh);
  return fresh;
}
