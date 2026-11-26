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

/** Link an accepted item number against the original server claim and verified seller.
 * SKU-less legacy recovery is decided by the backend, never inferred by the browser. */
export async function recoverSharedPendingPublication(input: StatusRecoveryInput & { externalListingId: string }): Promise<Record<string, unknown>> {
  const { client, userId, tenantId, nicheId, listingId, externalListingId } = input;
  if (!/^\d{6,20}$/.test(externalListingId)) throw new Error('Enter the existing eBay item number.');
  await activateModuleScope(client, userId, tenantId, nicheId);
  const read = async () => {
    const result = await client.from('listings').select('*,items!inner(tenant_id,status,sold_at)')
      .eq('id', listingId).eq('tenant_id', tenantId).eq('marketplace_id', 'ebay').eq('items.tenant_id', tenantId).single();
    if (result.error || !result.data) throw new Error('The pending listing is unavailable in this workspace.');
    return result.data as Record<string, unknown>;
  };
  const before = await read();
  if (before.external_listing_id && String(before.external_listing_id) !== externalListingId) throw new Error('The saved eBay identity changed. Refresh the existing listing.');
  if (!before.publish_claim_id) {
    if (String(before.external_listing_id || '') !== externalListingId) throw new Error('No pending server claim was found. Check the existing seller listing before continuing.');
    return checkSharedListingStatus(input);
  }
  const result = await callEdgeFunction<Record<string, unknown>>('swish-ebay-list', {
    route: 'recover_pending_publish', tenantId, nicheId, listingId, externalListingId,
  }, client);
  if (result.error) throw result.error;
  if (result.data?.success !== true || String(result.data.externalListingId || '') !== externalListingId) throw new Error('SWISH could not verify the existing eBay link. Nothing was resubmitted.');
  const fresh = await read();
  if (String(fresh.external_listing_id || '') !== externalListingId || fresh.publish_claim_id || !['active', 'sold', 'ended'].includes(String(fresh.status))) throw new Error('The existing eBay link and original claim are still reconciling. Refresh status; do not submit again.');
  assertInventoryReconciled(fresh);
  return fresh;
}

/** Native-equivalent End flow: one explicit server End request, then scoped
 * readback. Never mark Ended locally from a button click or uncertain response. */
export async function endSharedEbayListing({ client, userId, tenantId, nicheId, listingId }: StatusRecoveryInput): Promise<Record<string, unknown>> {
  await activateModuleScope(client, userId, tenantId, nicheId);
  const before = await client.from('listings').select('id,item_id,status,external_listing_id,publish_claim_id,items!inner(tenant_id,specialist_id)')
    .eq('id', listingId).eq('tenant_id', tenantId).eq('marketplace_id', 'ebay').eq('items.tenant_id', tenantId).single();
  if (before.error || !before.data) throw new Error('The saved eBay listing is unavailable. No end request was sent.');
  const row = before.data;
  const externalId = String(row.external_listing_id || '');
  if (!/^\d{6,20}$/.test(externalId) || row.publish_claim_id) throw new Error('The listing identity or publication is not confirmed. Check status before ending.');
  if (!['active','live'].includes(String(row.status).toLowerCase())) throw new Error('This listing is no longer recorded as Active. Check its current eBay status.');
  const { data, error } = await callEdgeFunction<Record<string, unknown>>('swish-ebay-list', {
    route: 'end', tenantId, nicheId, listingId, itemId: row.item_id, externalListingId: externalId,
  }, client);
  if (error) throw new Error('The eBay end outcome could not be confirmed. Check the existing listing before retrying: ' + error.message);
  if (data?.success !== true || data?.confirmed !== true || String(data.externalListingId || '') !== externalId)
    throw new Error(String(data?.error || 'eBay did not confirm the end. No local status was assumed.'));
  const result = await client.from('listings').select('*,items!inner(tenant_id,status,sold_at)')
    .eq('id', listingId).eq('tenant_id', tenantId).eq('marketplace_id','ebay').eq('items.tenant_id',tenantId).single();
  if (result.error || !result.data || result.data.status !== 'ended' || String(result.data.external_listing_id) !== externalId)
    throw new Error('eBay confirmed Ended but SWISH saved status is still pending. Refresh status; do not end twice.');
  return result.data as Record<string, unknown>;
}
