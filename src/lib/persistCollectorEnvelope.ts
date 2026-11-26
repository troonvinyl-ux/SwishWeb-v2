import { assertCaptureScope, captureRecord, captureText } from '@/lib/captureRequest';
import { attachCollectorEvidence } from '@/lib/collectorEnvelopeLead';
import { prefillCoinListingFacts } from '@/lib/coinListingFacts';
import { readOriginalCaptureDraft } from '@/lib/captureDraftRecovery';
import { changeRapidJob } from '@/lib/rapidCoinDatabase';
import type { CollectorEnvelopeRead } from '@/lib/readCollectorEnvelope';
import type { CaptureScope } from '@/types/capture';
import type { RapidCoinJob } from '@/types/rapidCoin';
/** Save evidence on the SAME physical item. Never change existing buyer copy, price, claims or publication history. */
export async function persistCollectorEnvelope(scope: CaptureScope, job: RapidCoinJob, read: CollectorEnvelopeRead): Promise<RapidCoinJob> {
  if (job.scope !== `${scope.userId}:${scope.tenantId}` || job.userId !== scope.userId || job.tenantId !== scope.tenantId || scope.nicheId !== 'coins' || !job.checkpoint.itemId) throw new Error('The envelope does not belong to this saved coin workspace.');
  if (job.publication !== 'none' || job.externalId || job.publicationAttempt) throw new Error('Inspect this coin’s existing publication; its identification was not changed.');
  const itemId = job.checkpoint.itemId;
  const listingId = await readOriginalCaptureDraft({ scope, itemId, specialistId: 'coins', captureId: job.id, listingId: job.checkpoint.listingId });
  await assertCaptureScope(scope);
  const stock = await scope.client.from('items').select('id,tenant_id,canonical_title,attributes,updated_at').eq('id', itemId).eq('tenant_id', scope.tenantId).single();
  if (stock.error || !stock.data || !stock.data.updated_at || captureRecord(stock.data.attributes)._rapid_capture_id !== job.id) throw new Error('The same saved coin could not be verified before retaining its envelope.');
  const old = job.checkpoint.identification || {}, candidate = read.identification;
  const hasCoinCandidate = !candidate.objectType || ['coin', 'unknown'].includes(String(candidate.objectType));
  const next = attachCollectorEvidence({ ...old, ...(!listingId && hasCoinCandidate ? candidate : {}), attributes: { ...captureRecord(old.attributes), ...(!listingId && hasCoinCandidate ? captureRecord(candidate.attributes) : {}) } }, read.evidence);
  // Retain only the new collector metadata, not stale visual attributes over a seller’s saved corrections.
  const collectorAttrs = captureRecord(attachCollectorEvidence({}, read.evidence).attributes);
  const attrs = prefillCoinListingFacts({ ...collectorAttrs, ...captureRecord(stock.data.attributes), collector_envelope: read.evidence,
    _rapid_coin_evidence: read.evidence, _collector_research_fields: collectorAttrs._collector_research_fields,
    observedCharacteristics: { ...captureRecord(captureRecord(stock.data.attributes).observedCharacteristics), ...captureRecord(candidate.observedCharacteristics) },
    _coin_reread_fields: { ...captureRecord(candidate.coinFields), ...captureRecord(candidate.attributes), ...captureRecord(candidate.attributesConfirmed) },
    _collector_candidate_title: captureText(next.canonicalTitle ?? next.title) }, captureText(next.canonicalTitle ?? next.title));
  const oldTitle = captureText(old.canonicalTitle ?? old.title), title = captureText(next.canonicalTitle ?? next.title);
  const rejectedOrUnattempted = !job.checkpoint.draftAttempted || job.checkpoint.draftFailure?.outcome === 'rejected';
  const safeTitle = !listingId && rejectedOrUnattempted && title && (!stock.data.canonical_title || stock.data.canonical_title === oldTitle);
  await assertCaptureScope(scope);
  const saved = await scope.client.from('items').update({ attributes: attrs, ...(safeTitle ? { canonical_title: title } : {}) }).eq('id', itemId).eq('tenant_id', scope.tenantId).eq('updated_at', stock.data.updated_at).select('id').maybeSingle();
  if (saved.error || !saved.data) throw new Error(saved.error?.message || 'The saved coin changed during the envelope read. Reopen the same item; nothing was republished.');
  await assertCaptureScope(scope);
  return changeRapidJob(job.id, job.scope, current => {
    if (current.updatedAt !== job.updatedAt || current.lease?.owner !== job.lease?.owner || current.publication !== 'none' || current.publicationAttempt || current.externalId) throw new Error('The capture changed. Envelope evidence was retained on its original item; refresh that item.');
    const canReprepare = !listingId && (!current.checkpoint.draftAttempted || current.checkpoint.draftFailure?.outcome === 'rejected');
    return { ...current, evidence: read.evidence, checkpoint: { ...current.checkpoint, identification: next, envelopeReadAttempted: true, envelopeReadError: undefined,
      ...(listingId ? { listingId } : {}), ...(canReprepare ? { preparation: undefined, generated: undefined } : {}) },
      message: 'Envelope transcription retained as collector-labelled identification evidence. Compare it with both coin faces; no publication was requested.' };
  });
}
