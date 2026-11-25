import { captureRequest, captureRecord, captureText, assertCaptureScope } from '@/lib/captureRequest';
import { prepareScanPhotos } from '@/lib/sharedScanPhotos';
import { loadCaptureProfile } from '@/lib/nativeCaptureProfiles';
import { prepareNumistaFaces, numistaIdentifyKnownAttributes, numistaAnchoredReview } from '@/lib/numistaCapture';
import { persistCaptureItem } from '@/lib/capturePersistence';
import { prepareStableQuickCapture } from '@/lib/listingStudioPreparation';
import { assertCoinDraftReady, canonicalCoinReferenceAnswers } from '@/lib/coinListingGate';
import { loadRapidPhotos, uploadRapidOriginals } from '@/lib/rapidCoinPhotos';
import { changeRapidJob } from '@/lib/rapidCoinDatabase';
import { collectorEvidence, RAPID_COIN_INSTRUCTIONS, RAPID_LISTING_INSTRUCTIONS, rapidBuyerSlots, rapidListingCopy } from '@/lib/rapidCoinPolicy';
import { prepareSavedCoinPhotos } from '@/lib/itemStudio';
import { itemPhotos, asRecord } from '@/lib/itemPhotos';
import type { CaptureScope, CaptureCheckpoint } from '@/types/capture';
import type { RapidCoinJob } from '@/types/rapidCoin';
/** Adapter to SWISH's existing identify, Numista, market, background removal and canonical draft engines. */
export async function prepareRapidCoin(scope: CaptureScope, initial: RapidCoinJob): Promise<void> {
  let job = initial;
  const photos = await loadRapidPhotos(job), typeId = assertCoinDraftReady(job.answers, photos);
  const profile = await loadCaptureProfile('coins', 'coins'), engineMode = profile.modes[0]?.id;
  if (!engineMode) throw new Error('The shared coin capture mode is unavailable. Originals remain queued.');
  const keep = async (checkpoint: CaptureCheckpoint) => {
    await assertCaptureScope(scope);
    job = await changeRapidJob(job.id, job.scope, current => {
      if (current.lease?.owner !== initial.lease?.owner) throw new Error('Capture worker changed. Stop this attempt.');
      return { ...current, checkpoint: { ...current.checkpoint, ...checkpoint } };
    });
  };
  if (!job.checkpoint.identification) {
    const selected = [...photos.filter(photo => ['obverse', 'reverse', 'envelope'].includes(photo.slotId)), ...photos.filter(photo => !['obverse', 'reverse', 'envelope'].includes(photo.slotId))].slice(0, 8);
    const prepared = await prepareScanPhotos(selected), faces = await prepareNumistaFaces(prepared);
    if (prepared.images.some(image => image.length > 800000) || JSON.stringify(prepared).length > 5500000) throw new Error('Analysis copies exceed the shared safe limit. Originals remain saved.');
    const payload = { ...prepared, numistaImages: faces, specialistId: 'coins', captureMode: engineMode,
      acquisitionContext: RAPID_COIN_INSTRUCTIONS,
      knownAttributes: { ...numistaIdentifyKnownAttributes(typeId || ''), weight: Number(job.answers.weight) || undefined, diameter: Number(job.answers.diameter) || undefined,
        customNotes: `${RAPID_COIN_INSTRUCTIONS}\nSeller notes: ${job.answers.notes || ''}\n${typeId ? `Seller explicitly confirms Numista N#${typeId} as the research anchor.` : 'No seller-confirmed catalogue reference.'}`,
        existingAttributes: { captureMode: engineMode, collectorEnvelopeMode: job.mode === 'envelope', collectorNotes: job.answers.notes || '', listing_generation_instructions: RAPID_LISTING_INSTRUCTIONS } } };
    if (new TextEncoder().encode(JSON.stringify({ ...payload, tenantId: scope.tenantId, nicheId: scope.nicheId })).byteLength > 6000000) throw new Error('Combined Numista and analysis copies exceed the shared request limit. Originals remain retained.');
    const response = await captureRequest(scope, 'swish-identify', payload);
    const wrapped = captureRecord(response.result), result = captureRecord(response.identification ?? wrapped.identification ?? response.result ?? response);
    if (!captureText(result.canonicalTitle ?? result.title)) throw new Error('No usable identification returned. Your capture is retained.');
    if (result.specialistId && result.specialistId !== 'coins' || result.objectType && !['coin', 'unknown'].includes(String(result.objectType))) throw new Error('The photographed object needs seller review before creating a coin listing.');
    const evidence = collectorEvidence(result), anchor = numistaAnchoredReview(response, [result], typeId || '');
    if (anchor.visualConflict) evidence.discrepancies.push('Numista research anchor and visual identification differ. Compare the original faces; the anchor was not replaced.');
    const attrs = captureRecord(result.attributes), roles = Array.isArray(attrs.photo_roles) ? attrs.photo_roles.map(captureRecord) : [];
    job = await changeRapidJob(job.id, job.scope, current => ({ ...current, evidence, photos: current.photos.map(photo => {
      const role = roles.find(row => row.slotId === photo.slotId)?.role;
      return { ...photo, role: photo.slotId === 'envelope' || role === 'evidence' ? 'evidence' : photo.role };
    }) }));
    await keep({ identification: { ...result, ...(anchor.catalogueRetrieved ? { canonicalTitle: captureText(captureRecord(result.numistaVerification ?? response.numistaVerification).title) || result.canonicalTitle } : {}),
      attributes: { ...attrs, collector_envelope: evidence, _rapid_coin_evidence: evidence, _rapid_capture_id: job.id, listing_generation_instructions: RAPID_LISTING_INSTRUCTIONS,
        ...(typeId ? { seller_confirmed_numista: typeId } : {}) } } });
  }
  const result = job.checkpoint.identification!, referenceAnswers = typeId ? canonicalCoinReferenceAnswers(job.answers, typeId) : job.answers;
  const answers = { ...referenceAnswers, condition: job.answers.condition || captureText(result.condition), listing_generation_instructions: RAPID_LISTING_INSTRUCTIONS };
  if (!rapidBuyerSlots(job).includes('obverse') || !rapidBuyerSlots(job).includes('reverse')) throw new Error('A required face was classified as identification evidence. Correct its role before continuing.');
  if (!job.checkpoint.itemId) {
    await keep({ itemAttempted: true });
    await keep({ itemId: await persistCaptureItem(scope, result, 'coins', answers, engineMode, job.id) });
  }
  await uploadRapidOriginals(scope, job, photos, urls => keep({ photos: urls }));
  const draft = await prepareStableQuickCapture({ scope, photos, specialistId: 'coins', mode: engineMode, answers, checkpoint: job.checkpoint,
    stableItemId: job.id, buyerSlots: rapidBuyerSlots(job), transformGenerated: rapidListingCopy, onCheckpoint: keep,
    onProgress: message => { console.log('[SWISH rapid] Stage', job.id, message); } });
  // BackgroundErase is optional. Only its source-pixels/fidelity-verified presentations may replace buyer selections.
  await prepareSavedCoinPhotos(scope.userId, scope.tenantId, draft.itemId, draft.photos).catch((cause: unknown) => draft.warnings.push(cause instanceof Error ? cause.message : 'Background removal unavailable; originals selected.'));
  await assertCaptureScope(scope);
  const stock = await scope.client.from('items').select('id,attributes,media,updated_at').eq('id', draft.itemId).eq('tenant_id', scope.tenantId).single();
  if (stock.error || !stock.data) throw new Error('Draft saved. Reopen the original item to verify photographs.');
  const presentations = itemPhotos(stock.data).filter(photo => draft.photos.includes(photo.original)).map(photo => photo.presentation);
  const selected = presentations.length ? presentations : draft.photos;
  const saved = await scope.client.from('items').update({ attributes: { ...asRecord(stock.data.attributes), ebay_listing_media: selected, _rapid_photo_roles: job.photos.map(photo => ({ slotId: photo.slotId, label: photo.label, role: photo.role, original: job.checkpoint.photos?.[photo.slotId] })) } }).eq('id', draft.itemId).eq('tenant_id', scope.tenantId).eq('updated_at', stock.data.updated_at).select('id').maybeSingle();
  if (saved.error || !saved.data) throw new Error('Photo selection changed. Review the same saved draft; originals are retained.');
  const missingTranscription = job.mode === 'envelope' && !job.evidence?.transcriptionAvailable;
  await changeRapidJob(job.id, job.scope, current => ({ ...current, processing: 'ready', lease: undefined, draft: { ...draft, photos: selected },
    message: missingTranscription ? 'Envelope transcription was not returned. Review the original envelope or add seller notes; the factual draft remains editable.' : job.evidence?.discrepancies.length ? 'Compare the highlighted evidence discrepancies.' : 'Draft prepared. Review the item, price and delivery before publishing.' }));
}
