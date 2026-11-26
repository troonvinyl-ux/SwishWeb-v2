import { assertCaptureScope, captureRecord } from '@/lib/captureRequest';
import type { CaptureScope } from '@/types/capture';
interface DraftRecoveryInput { scope: CaptureScope; itemId: string; specialistId?: string; captureId?: string; listingId?: string; }
/** Read-only, exact-item recovery. A missing row never proves that an uncertain RPC rolled back. */
export async function readOriginalCaptureDraft({ scope, itemId, specialistId, captureId, listingId }: DraftRecoveryInput): Promise<string | null> {
  await assertCaptureScope(scope);
  const stock = await scope.client.from('items').select('id,tenant_id,specialist_id,status,sold_at,attributes').eq('id', itemId).eq('tenant_id', scope.tenantId).maybeSingle();
  if (stock.error || !stock.data || stock.data.tenant_id !== scope.tenantId) throw new Error(stock.error?.message || 'The original saved item could not be verified. Nothing was recreated.');
  if (specialistId && stock.data.specialist_id !== specialistId || captureId && captureRecord(stock.data.attributes)._rapid_capture_id !== captureId) throw new Error('The inventory record does not match this original capture. Nothing was recreated.');
  if (stock.data.sold_at || ['listed', 'active', 'live', 'sold', 'fulfilled', 'completed'].includes(String(stock.data.status))) throw new Error('This stock item already has marketplace activity. Inspect its existing listing before continuing.');
  const saved = await scope.client.from('listings').select('id,item_id,tenant_id,status,external_listing_id,publish_claim_id,published_at,ended_at').eq('tenant_id', scope.tenantId).eq('item_id', itemId).eq('marketplace_id', 'ebay').order('created_at', { ascending: false }).limit(101);
  await assertCaptureScope(scope);
  if (saved.error || !Array.isArray(saved.data) || saved.data.length > 100) throw new Error(saved.error?.message || 'All saved listings could not be checked. No draft was recreated.');
  const rows = saved.data.map(captureRecord);
  if (rows.some(row => row.tenant_id !== scope.tenantId || row.item_id !== itemId || !row.id)) throw new Error('Saved listing ownership could not be verified.');
  if (rows.some(row => row.external_listing_id || row.publish_claim_id || row.published_at || row.ended_at || !['draft', 'review', 'review_required'].includes(String(row.status)))) throw new Error('This item already has a submission or marketplace history. Inspect the existing listing; nothing was republished.');
  if (listingId) {
    if (!rows.some(row => row.id === listingId)) throw new Error('The original draft ID could not be read. Retry readback, not creation.');
    return listingId;
  }
  if (rows.length > 1) throw new Error('More than one saved draft exists for this coin. Open its inventory record and select the original draft; no new draft was created.');
  return rows.length === 1 ? String(rows[0].id) : null;
}
