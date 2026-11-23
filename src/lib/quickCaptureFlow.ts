import { prepareScanPhotos } from '@/lib/sharedScanPhotos';
import { captureRequest, assertCaptureScope, captureRecord, captureText, captureStrings } from '@/lib/captureRequest';
import { persistCaptureItem, persistCapturePhotos } from '@/lib/capturePersistence';
import { assertCoinDraftReady, canonicalCoinReferenceAnswers } from '@/lib/coinListingGate';
import { captureNumistaReference, parseNumistaNumber, prepareNumistaFaces } from '@/lib/numistaCapture';
import { unattributedCoinCopy } from '@/lib/listingEvidence';
import type { CaptureCheckpoint, CaptureDraft, CapturePhoto, CaptureScope } from '@/types/capture';
interface PrepareCaptureOptions { scope: CaptureScope; photos: CapturePhoto[]; specialistId: string; mode: string; answers: Record<string, string>; checkpoint: CaptureCheckpoint; onCheckpoint: (value: CaptureCheckpoint) => void; onProgress: (message: string) => void; lead?: Record<string, unknown> | null; }
async function identifyCapture(options: PrepareCaptureOptions): Promise<Record<string, unknown>> {
  const { scope, photos, specialistId, mode, answers } = options;
  const prepared = await prepareScanPhotos(photos);
  if (prepared.images.length > 8 || prepared.images.some(image => image.length > 800000)) throw new Error('Use at most eight analysis photos and reduce oversized photos. Your originals are unchanged.');
  const numistaImages = scope.nicheId === 'coins' && specialistId === 'coins' ? await prepareNumistaFaces(prepared) : [];
  const reference = scope.nicheId === 'coins' ? captureNumistaReference({}, answers.numista_number) : null;
  const notes = Object.entries(answers).filter(([, value]) => value.trim()).map(([key, value]) => `${key}: ${value} (seller supplied)`);
  if (reference) notes.push(`Seller supplied Numista ${reference.numistaN}: ${reference.url}. Compare BOTH original faces and physical measurements. This reference is a candidate, not a verified physical identity; report contradictions and never copy catalogue photos or descriptions.`);
  const payload: Record<string, unknown> = {
    ...prepared, ...(numistaImages.length ? { numistaImages } : {}), specialistId, captureMode: mode,
    acquisitionContext: 'Universal Quick List. Identify from original photographs, compare any barcode lead with physical evidence. Keep uncertain identity, condition and catalogue references provisional.',
    knownAttributes: { weight: Number(answers.weight) || undefined, diameter: Number(answers.diameter) || undefined,
      ...(reference ? { numistaTypeId: reference.typeId, numistaReference: reference.url } : {}),
      customNotes: notes.join('\n'), existingAttributes: { ...answers, captureMode: mode, ...(options.lead ? { barcodeLead: options.lead } : {}) } },
  };
  if (new TextEncoder().encode(JSON.stringify({ ...payload, tenantId: scope.tenantId, nicheId: scope.nicheId })).byteLength > 6000000) throw new Error('Analysis photos exceed the safe upload limit. Use fewer or smaller photos; your originals are retained.');
  const data = await captureRequest(scope, 'swish-identify', payload);
  const identification = captureRecord(data.identification ?? captureRecord(data.result).identification ?? data.result ?? data);
  const result: Record<string, unknown> = { ...identification, ...(data.numistaImageSearch ? { numistaImageSearch: data.numistaImageSearch } : {}) };
  if (!captureText(result.canonicalTitle ?? result.title)) throw new Error('No usable identification returned. Retake the evidence or edit your observations.');
  if (result.specialistId && result.specialistId !== specialistId) throw new Error('The identification belongs to a different specialist.');
  return result;
}
/** Next prepares one canonical item and draft; it never publishes or automatically replays a request. */
export async function prepareQuickCapture(options: PrepareCaptureOptions): Promise<CaptureDraft> {
  const { scope, photos, specialistId, mode, answers, onProgress, onCheckpoint } = options;
  const numistaTypeId = scope.nicheId === 'coins' ? assertCoinDraftReady(answers, photos) : null;
  if (scope.nicheId !== 'coins' && answers.numista_number && !parseNumistaNumber(answers.numista_number)) throw new Error('Enter a valid Numista N# before continuing.');
  const savedAnswers = numistaTypeId ? canonicalCoinReferenceAnswers(answers, numistaTypeId) : answers;
  const checkpoint: CaptureCheckpoint = { ...options.checkpoint };
  const keep = (value: CaptureCheckpoint) => { Object.assign(checkpoint, value); onCheckpoint({ ...checkpoint }); };
  if (!checkpoint.identification) { onProgress('Identifying the photographed evidence…'); keep({ identification: await identifyCapture(options) }); }
  const result = checkpoint.identification!;
  // A catalogue match suggested by image AI is not a seller-confirmed
  // attribution. Preserve the original observations but use an unattributed
  // canonical item title when the seller supplied no catalogue reference.
  const unidentifiedCoin = scope.nicheId === 'coins' && !numistaTypeId;
  const physicalCopy = unidentifiedCoin ? unattributedCoinCopy(savedAnswers.weight, savedAnswers.diameter) : null;
  const itemEvidence = physicalCopy ? { ...result, canonicalTitle: physicalCopy.title,
    identificationState: 'unattributed', _seller_unattributed: true } : result;
  if (!checkpoint.itemId) { onProgress('Saving this physical item…'); keep({ itemId: await persistCaptureItem(scope, itemEvidence, specialistId, savedAnswers, mode) }); }
  onProgress('Attaching permanent original photographs…');
  const urls = await persistCapturePhotos(scope, checkpoint.itemId!, photos, checkpoint.photos ?? {}, value => keep({ photos: value }));
  if (!checkpoint.generated) {
    onProgress('Preparing listing title and description…');
    const response = await captureRequest(scope, 'swish-list-generate', { item_id: checkpoint.itemId, tenant_id: scope.tenantId, marketplace_id: 'ebay' });
    const generated = captureRecord(response.listing);
    if (!captureText(generated.title)) throw new Error('Item and photos saved, but listing generation returned no draft. Retry preparation on this item.');
    keep({ generated: physicalCopy ? { ...generated, title: physicalCopy.title, description: physicalCopy.description } : generated });
  }
  const generated = checkpoint.generated!;
  if (!checkpoint.listingId) {
    onProgress('Saving the listing draft for your review…'); await assertCaptureScope(scope);
    const saved = await scope.client.rpc('swish_create_listing_draft', { p_tenant_id: scope.tenantId, p_item_id: checkpoint.itemId, p_marketplace_id: 'ebay', p_listing: generated, p_shipping_cost: 0, p_category_id: null });
    if (saved.error || typeof saved.data !== 'string' || !saved.data) throw new Error(saved.error?.message ?? 'Draft creation was not confirmed. Inspect saved inventory before continuing.');
    keep({ listingId: saved.data });
  }
  await assertCaptureScope(scope);
  const read = await scope.client.from('listings').select('id,title,description,price,external_listing_id,publish_claim_id,status').eq('id', checkpoint.listingId!).eq('tenant_id', scope.tenantId).single();
  if (read.error || !read.data) throw new Error('Draft saved, but readback is unavailable. Retry readback, not publication.');
  if (read.data.external_listing_id || read.data.publish_claim_id || ['active', 'live'].includes(String(read.data.status))) throw new Error('An existing submission needs inspection. Open this listing; do not publish it again.');
  const reference = scope.nicheId === 'coins' && numistaTypeId ? captureNumistaReference(result, savedAnswers.numista_number) : null;
  const backendReference = captureNumistaReference(result);
  const referenceConflict = reference?.source === 'seller_reference' && backendReference && reference.typeId !== backendReference.typeId ? [`Your Numista ${reference.numistaN} differs from the backend candidate ${backendReference.numistaN}. Resolve the reference against both original faces before listing.`] : [];
  const research = scope.nicheId === 'coins' ? captureRecord(result.numistaImageSearch) : {};
  return { itemId: checkpoint.itemId!, listingId: checkpoint.listingId!, title: String(read.data.title), description: String(read.data.description || ''), price: read.data.price == null ? null : Number(read.data.price), photos: urls,
    warnings: [...captureStrings(result.warnings), ...captureStrings(result.evidenceContradictory), ...captureStrings(result.missingInformation), ...captureStrings(generated.safety_flags), ...(physicalCopy ? ['Unattributed draft: AI suggestions are not confirmed facts; verify condition, category and authenticity safeguards before publishing.'] : []), ...referenceConflict],
    numistaReference: reference, ...(Object.keys(research).length ? { numistaResearch: research } : {}) };
}
