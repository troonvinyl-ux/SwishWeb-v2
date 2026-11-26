import { prepareQuickCapture } from '@/lib/quickCaptureFlow';
import { assertCaptureScope } from '@/lib/captureRequest';
import type { CaptureCheckpoint, CaptureDraft } from '@/types/capture';
type PreparationOptions = Parameters<typeof prepareQuickCapture>[0];
/** Recovery guard around the existing engine, not a second draft/publication pipeline. */
export async function prepareStableQuickCapture(options: PreparationOptions): Promise<CaptureDraft> {
  await assertCaptureScope(options.scope);
  let checkpoint: CaptureCheckpoint = { ...options.checkpoint };
  const keep = async (value: CaptureCheckpoint) => { checkpoint = { ...checkpoint, ...value }; await options.onCheckpoint(checkpoint); };
  if (options.stableItemId && !checkpoint.itemId) {
    const original = await options.scope.client.from('items').select('id,attributes,specialist_id').eq('tenant_id', options.scope.tenantId).eq('id', options.stableItemId).maybeSingle();
    if (original.error) throw new Error('Cannot recover the original rapid-capture ID. Retry readback, not item creation.');
    if (original.data) {
      const attrs = original.data.attributes as Record<string, unknown> | null;
      if (attrs?._rapid_capture_id !== options.stableItemId || original.data.specialist_id !== options.specialistId) throw new Error('The rapid-capture ID does not match this item.');
      await keep({ itemId: String(original.data.id) });
    }
  }
  if (checkpoint.itemAttempted && !checkpoint.itemId && !options.stableItemId) throw new Error('The earlier item save has an uncertain result. Inspect inventory before starting another item; the insert will not be replayed.');
  if (checkpoint.itemId && !checkpoint.listingId) {
    const existing = await options.scope.client.from('listings').select('id,status,external_listing_id,publish_claim_id').eq('tenant_id', options.scope.tenantId).eq('item_id', checkpoint.itemId).eq('marketplace_id', 'ebay').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (existing.error) throw new Error('Existing draft lookup failed. Retry readback, not draft creation.');
    await assertCaptureScope(options.scope);
    if (existing.data) {
      if (existing.data.external_listing_id || existing.data.publish_claim_id || !['draft', 'review', 'review_required'].includes(String(existing.data.status))) throw new Error('This item already has a submission. Inspect its saved listing; no new draft or publication was sent.');
      await keep({ listingId: String(existing.data.id) });
    } else if (checkpoint.draftAttempted) throw new Error('The earlier draft save has an uncertain result. Inspect this item in inventory; draft creation will not be replayed automatically.');
  }
  return prepareQuickCapture({ ...options, checkpoint, onCheckpoint: keep,
    beforeItem: async () => { await keep({ itemAttempted: true }); await options.beforeItem?.(); },
    beforeDraft: async () => { await keep({ draftAttempted: true }); await options.beforeDraft?.(); },
    onProgress: options.onProgress,
  });
}
