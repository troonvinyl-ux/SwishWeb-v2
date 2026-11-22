import type { SupabaseClient } from '@supabase/supabase-js';
import { activateModuleScope, verifyModuleScope } from '@/lib/moduleScope';
import { type CanonicalCounts, type InventoryEntry, parseCanonicalCounts, projectInventoryRows, inventoryCountsInView } from '@/lib/inventoryNative';

/** Same OnSpace Cloud canonical views / RPC as native SWISH.
 * This is read-only. Neither web inventory opening nor refresh syncs/publishes eBay.
 * A missing view or incomplete projection is an error, not an invented empty shop. */
export async function readNativeInventory(
  client: SupabaseClient, userId: string, tenantId: string, nicheId: string,
  specialistIds: string[], signal?: AbortSignal,
): Promise<{ entries: InventoryEntry[]; counts: CanonicalCounts }> {
  if (!userId || !tenantId || !nicheId || !specialistIds.length)
    throw new Error('Select an authorized SWISH account and specialist workspace.');
  await activateModuleScope(client, userId, tenantId, nicheId);
  const readCounts = async () => {
    const call = client.rpc('swish_inventory_tab_counts', { p_tenant_id: tenantId, p_niche_id: nicheId });
    const { data, error } = await (signal ? call.abortSignal(signal) : call);
    if (error) throw new Error('Canonical inventory count read failed: ' + error.message);
    return parseCanonicalCounts(data);
  };
  const counts = await readCounts();
  const rows: Record<string, unknown>[] = [];
  const PAGE_SIZE = 200;
  for (let offset = 0; offset < 50000; offset += PAGE_SIZE) {
    if (signal?.aborted) throw new Error('Inventory read was cancelled.');
    let query = client.from('swish_inventory_canonical_rows').select('*')
      .eq('tenant_id', tenantId).in('specialist_id', specialistIds)
      .order('sort_at', { ascending: false }).order('item_id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw new Error('Canonical inventory read failed: ' + error.message);
    const page = (data || []) as unknown as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) {
      const entries = projectInventoryRows(rows, tenantId, specialistIds);
      if (entries.length !== counts.total)
        throw new Error('Inventory changed while loading. Refresh to verify the complete collection.');
      const categorized = inventoryCountsInView(entries);
      for (const tab of ['stock', 'draft', 'live', 'sold', 'archived'] as const) {
        if (categorized[tab] !== counts[tab])
          throw new Error('Inventory categories changed during the read. Refresh to reconcile the items.');
      }
      if (counts.revision) {
        const latest = await readCounts();
        if (latest.revision !== counts.revision)
          throw new Error('Inventory changed during the read. Refresh to obtain current counts.');
      }
      await verifyModuleScope(client, userId, tenantId, nicheId);
      if (signal?.aborted) throw new Error('Inventory read was cancelled.');
      return { entries, counts };
    }
  }
  throw new Error('Inventory exceeds the native bounded query size. Narrow the scope before loading.');
}
