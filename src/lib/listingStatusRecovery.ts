import type { SupabaseClient } from '@supabase/supabase-js';
import { callEdgeFunction } from '@/lib/supabase';
import { activateModuleScope } from '@/lib/moduleScope';
interface StatusRecoveryInput { client: SupabaseClient; userId: string; tenantId: string; nicheId: string; listingId: string; }
/** Same status-only endpoint as the native app; never submits a new eBay listing. */
export async function checkSharedListingStatus({ client, userId, tenantId, nicheId, listingId }: StatusRecoveryInput): Promise<Record<string, unknown>> {
  await activateModuleScope(client, userId, tenantId, nicheId);
  const read = async () => {
    const response = await client.from('listings').select('*').eq('id', listingId).eq('tenant_id', tenantId).eq('marketplace_id', 'ebay').single();
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
  return fresh;
}
