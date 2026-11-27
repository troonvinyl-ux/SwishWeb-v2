import { assertCaptureScope, captureText, captureRecord } from '@/lib/captureRequest';
import { parseNumistaNumber } from '@/lib/numistaCapture';
import { scanPhotoStoragePath } from '@/lib/sharedScanPhotos';
import { prefillCoinListingFacts } from '@/lib/coinListingFacts';
import type { CaptureScope, CapturePhoto } from '@/types/capture';
/** A missing physical measurement remains unknown, never a fabricated zero. */
const measured = (value: string | undefined): number | null => value?.trim() && Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
export async function persistCaptureItem(scope: CaptureScope, result: Record<string, unknown>, specialistId: string, answers: Record<string, string>, mode: string, stableId?: string): Promise<string> {
  await assertCaptureScope(scope);
  if (stableId) {
    const existing = await scope.client.from('items').select('id,attributes,specialist_id').eq('id', stableId).eq('tenant_id', scope.tenantId).maybeSingle();
    if (existing.error) throw new Error('Cannot inspect the original rapid-capture inventory ID. No insert was sent.');
    if (existing.data) {
      if (existing.data.specialist_id !== specialistId || captureRecord(existing.data.attributes)._rapid_capture_id !== stableId) throw new Error('Rapid capture ID belongs to a different item. No insert was sent.');
      return String(existing.data.id);
    }
  }
  const weight = measured(answers.weight), diameter = measured(answers.diameter), coin = scope.nicheId === 'coins';
  const captured = { ...result, ...captureRecord(result.attributesInferred), ...captureRecord(result.attributes), ...captureRecord(result.attributesConfirmed), ...answers, captureMode: mode,
    ...(stableId ? { _rapid_capture_id: stableId } : {}),
    _scan_provenance: { identification: 'AI suggestion — not physical confirmation', seller_fields: Object.keys(answers).filter(key => answers[key]?.trim()) },
    ...(coin && weight !== null ? { supplied_weight_g: weight } : {}), ...(coin && diameter !== null ? { supplied_diameter_mm: diameter } : {}) };
  const attributes = coin ? prefillCoinListingFacts(captured, captureText(result.canonicalTitle ?? result.title)) : captured;
  const saved = await scope.client.from('items').insert({ ...(stableId ? { id: stableId } : {}), tenant_id: scope.tenantId, specialist_id: specialistId,
    canonical_title: captureText(result.canonicalTitle ?? result.title), description: captureText(result.description), condition: answers.condition || '',
    condition_notes: answers.condition_notes || answers.flaws || answers.issues || '', status: 'review', attributes, media: [], warnings: ['Review AI suggestions against the actual item.'],
    ...(coin ? { weight_grams: weight, dimensions_mm: diameter !== null ? { diameter } : {} } : {}) }).select('id,attributes').single();
  if (saved.error || !saved.data?.id) throw new Error(saved.error?.message || 'Item creation was not confirmed. Inspect inventory before retrying.');
  const expectedNumistaId = parseNumistaNumber(answers.numista_type_id ?? answers.numista_number);
  if (coin && expectedNumistaId) {
    const stored = captureRecord(saved.data.attributes), retainedId = parseNumistaNumber(stored.numista_type_id ?? stored.numista_number);
    if (retainedId !== expectedNumistaId || stored._numista_reference_source !== 'seller_reference') throw new Error(`Coin saved, but Numista N#${expectedNumistaId} was not retained. Open the saved item and correct the reference before creating a draft.`);
  }
  return String(saved.data.id);
}
export async function persistCapturePhotos(scope: CaptureScope, itemId: string, photos: CapturePhoto[], existing: Record<string, string>, checkpoint: (value: Record<string, string>) => void | Promise<void>): Promise<string[]> {
  const urls = { ...existing };
  for (const photo of photos) {
    if (urls[photo.slotId]) continue;
    await assertCaptureScope(scope);
    const path = scanPhotoStoragePath(itemId, photo.slotId, photo.file), saved = await scope.client.storage.from('item-images').upload(path, photo.file, { contentType: photo.file.type || 'image/jpeg', upsert: false });
    if (saved.error) throw new Error(saved.error.message);
    urls[photo.slotId] = scope.client.storage.from('item-images').getPublicUrl(path).data.publicUrl; await checkpoint({ ...urls });
  }
  await assertCaptureScope(scope);
  const media = photos.map(photo => urls[photo.slotId]).filter(Boolean);
  const saved = await scope.client.from('items').update({ media }).eq('id', itemId).eq('tenant_id', scope.tenantId).select('id').single();
  if (saved.error || !saved.data) throw new Error(saved.error?.message || 'Photo attachment was not confirmed.');
  return media;
}
