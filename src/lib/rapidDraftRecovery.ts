import { assertCaptureScope, draftRejectionCode } from '@/lib/captureRequest';
import { readOriginalCaptureDraft } from '@/lib/captureDraftRecovery';
import { changeRapidJob } from '@/lib/rapidCoinDatabase';
import type { CaptureScope } from '@/types/capture';
import type { RapidCoinJob } from '@/types/rapidCoin';
export interface RapidDraftRecoveryResult { resumed: boolean; message: string; }
/** User-initiated local journal repair only. No draft creation or eBay submission here. */
export async function recoverRapidDraft(scope: CaptureScope, job: RapidCoinJob): Promise<RapidDraftRecoveryResult> {
  if (job.userId !== scope.userId || job.tenantId !== scope.tenantId || job.scope !== `${scope.userId}:${scope.tenantId}` || scope.nicheId !== 'coins') throw new Error('Open this capture in its original seller workspace.');
  if (job.processing === 'processing' || (job.lease?.until || 0) > Date.now() || job.publication !== 'none' || job.externalId || job.publicationAttempt) throw new Error('The original job is still processing or has a publication attempt. Check its existing status instead.');
  const itemId = job.checkpoint.itemId || job.id;
  const listingId = await readOriginalCaptureDraft({ scope, itemId, specialistId: 'coins', captureId: job.id, listingId: job.checkpoint.listingId });
  const failure = job.checkpoint.draftFailure;
  const rejected = failure?.outcome === 'rejected' && Boolean(draftRejectionCode(failure));
  if (!listingId && job.checkpoint.draftAttempted && !rejected) return { resumed: false, message: 'No saved draft was found, but the earlier response is still unconfirmed. Open the original inventory record or check again; no new draft or eBay listing was created.' };
  await assertCaptureScope(scope);
  await changeRapidJob(job.id, job.scope, current => {
    if (current.updatedAt !== job.updatedAt || current.processing === 'processing' || current.lease || current.publication !== 'none' || current.publicationAttempt || current.externalId) throw new Error('The capture changed while checking. Refresh and check the same capture again.');
    return { ...current, processing: 'captured', enqueued: true, deferred: false,
      checkpoint: { ...current.checkpoint, itemId, ...(listingId ? { listingId } : { draftAttempted: false, draftFailure: undefined, preparation: undefined, generated: undefined }) },
      message: listingId ? 'Original saved draft found. Resuming readback and photo selection; no duplicate draft was created.' : rejected ? 'The earlier draft RPC was explicitly rejected. Retrying preparation on the same verified inventory item.' : 'Resuming preparation on the original verified item.' };
  });
  return { resumed: true, message: listingId ? 'Original draft recovered. Its review editor will reopen after readback.' : 'Preparation resumed on the same saved coin. Nothing has been published.' };
}
