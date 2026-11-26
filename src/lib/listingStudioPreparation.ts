import { prepareQuickCapture } from '@/lib/quickCaptureFlow';
import { assertCaptureScope } from '@/lib/captureRequest';
import { readOriginalCaptureDraft } from '@/lib/captureDraftRecovery';
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
    const existingId = await readOriginalCaptureDraft({ scope: options.scope, itemId: checkpoint.itemId, specialistId: options.specialistId, captureId: options.stableItemId });
    if (existingId) await keep({ listingId: existingId });
    else if (checkpoint.draftAttempted) throw new Error(checkpoint.draftFailure?.outcome === 'rejected'
      ? `The earlier draft was rejected: ${checkpoint.draftFailure.message}. Use Check saved draft / resume to retry on this same item.`
      : 'The earlier draft save has an uncertain result. Use Check saved draft / resume; draft creation will not be replayed automatically.');
  }
  return prepareQuickCapture({ ...options, checkpoint, onCheckpoint: keep,
    beforeItem: async () => { await keep({ itemAttempted: true }); await options.beforeItem?.(); },
    beforeDraft: async () => { await options.beforeDraft?.(); await keep({ draftAttempted: true, draftFailure: undefined }); },
    onProgress: options.onProgress,
  });
}
