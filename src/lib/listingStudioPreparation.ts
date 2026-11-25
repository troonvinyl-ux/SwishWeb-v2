import { prepareQuickCapture } from '@/lib/quickCaptureFlow';
import { assertCaptureScope } from '@/lib/captureRequest';
import type { CaptureCheckpoint, CaptureDraft } from '@/types/capture';
type PreparationOptions = Parameters<typeof prepareQuickCapture>[0];
/** Recovery guard around the existing engine, not a second draft/publication pipeline. */
export async function prepareStableQuickCapture(options: PreparationOptions): Promise<CaptureDraft> {
  await assertCaptureScope(options.scope);
  let checkpoint: CaptureCheckpoint = { ...options.checkpoint };
  const keep = (value: CaptureCheckpoint) => { checkpoint = { ...checkpoint, ...value }; options.onCheckpoint(checkpoint); };
  if (checkpoint.itemAttempted && !checkpoint.itemId) throw new Error('The earlier item save has an uncertain result. Inspect inventory before starting another item; the insert will not be replayed.');
  if (checkpoint.itemId && !checkpoint.listingId) {
    const existing = await options.scope.client.from('listings').select('id,status,external_listing_id,publish_claim_id').eq('tenant_id', options.scope.tenantId).eq('item_id', checkpoint.itemId).eq('marketplace_id', 'ebay').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (existing.error) throw new Error('Existing draft lookup failed. Retry readback, not draft creation.');
    await assertCaptureScope(options.scope);
    if (existing.data) {
      if (existing.data.external_listing_id || existing.data.publish_claim_id || !['draft', 'review', 'review_required'].includes(String(existing.data.status))) throw new Error('This item already has a submission. Inspect its saved listing; no new draft or publication was sent.');
      keep({ listingId: String(existing.data.id) });
    } else if (checkpoint.draftAttempted) throw new Error('The earlier draft save has an uncertain result. Inspect this item in inventory; draft creation will not be replayed automatically.');
  }
  return prepareQuickCapture({ ...options, checkpoint, onCheckpoint: keep, onProgress: message => {
    if (message === 'Saving this physical item…') keep({ itemAttempted: true });
    if (message === 'Saving the listing draft for your review…') keep({ draftAttempted: true });
    options.onProgress(message);
  } });
}
