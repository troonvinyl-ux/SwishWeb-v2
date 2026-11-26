import { assertCaptureScope } from '@/lib/captureRequest';
import { rapidJob, changeRapidJob } from '@/lib/rapidCoinDatabase';
import type { CaptureScope } from '@/types/capture';
import type { RapidCoinJob } from '@/types/rapidCoin';
/** Existing native ai_id_feedback contract. Only explicit seller corrections are learning evidence. */
export async function recordRapidCoinCorrection(scope: CaptureScope, job: RapidCoinJob, correctedTitle: string, notes: string): Promise<void> {
  if (job.scope !== `${scope.userId}:${scope.tenantId}` || job.userId !== scope.userId || job.tenantId !== scope.tenantId) throw new Error('Correction belongs to another seller or tenant.');
  if (!job.checkpoint.itemId || !correctedTitle.trim() || !notes.trim()) throw new Error('Enter the seller-confirmed identity and correction notes.');
  await assertCaptureScope(scope);
  const current = await rapidJob(job.id);
  if (!current || current.scope !== job.scope) throw new Error('Original capture is unavailable. No learning record was created.');
  const candidate = current.feedbackId || crypto.randomUUID();
  const retained = await changeRapidJob(job.id, job.scope, row => ({ ...row, feedbackId: row.feedbackId || candidate })), id = retained.feedbackId!;
  const existing = await scope.client.from('ai_id_feedback').select('id').eq('id', id).eq('tenant_id', scope.tenantId).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return;
  await assertCaptureScope(scope);
  const result = await scope.client.from('ai_id_feedback').insert({ id, tenant_id: scope.tenantId, item_id: job.checkpoint.itemId, specialist_id: 'coins',
    ai_canonical_title: String(job.checkpoint.identification?.canonicalTitle || ''), ai_attributes: job.checkpoint.identification?.attributes || {}, ai_confidence: Number(job.checkpoint.identification?.confidence) || 0,
    original_canonical_title: correctedTitle.trim(), original_attributes: { seller_confirmed: true, catalogue_reference: job.answers.numista_number || '', correction_notes: notes.trim() },
    feedback: 'partial', correction_notes: notes.trim(), error_category: 'wrong_identity', image_urls: job.draft?.photos || [] }).select('id').single();
  if (result.error || !result.data) throw new Error(result.error?.message || 'Correction save was not confirmed. Retry the same retained evidence ID.');
}
