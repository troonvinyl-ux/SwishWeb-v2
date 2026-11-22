import type { NumistaFace, NumistaReference, NumistaVisualCandidate } from '@/types/numista';
import type { PreparedScanPhotos } from '@/lib/sharedScanPhotos';
/** A reference is not an identification or authentication. Only registered Numista catalogue URLs are accepted. */
export function parseNumistaNumber(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).trim();
  const match = /^(?:N\s*#?\s*)?([1-9]\d{0,8})$/i.exec(text) || /^https:\/\/(?:en\.)?numista\.com\/catalogue\/pieces([1-9]\d{0,8})\.html(?:[?#].*)?$/.exec(text);
  return match ? Number(match[1]) : null;
}
export function numistaReference(typeId: number, source: NumistaReference['source']): NumistaReference {
  return { typeId, numistaN: `N#${typeId}`, url: `https://en.numista.com/catalogue/pieces${typeId}.html`, source };
}
export function captureNumistaReference(result: Record<string, unknown>, supplied?: string): NumistaReference | null {
  const manual = parseNumistaNumber(supplied); if (manual) return numistaReference(manual, 'seller_reference');
  const verification = result.numistaVerification && typeof result.numistaVerification === 'object' ? result.numistaVerification as Record<string, unknown> : {};
  const id = parseNumistaNumber(result.numistaTypeId ?? result.numista_type_id ?? verification.typeId ?? result.numistaN ?? result.numista_n);
  if (result._numista_reference_source === 'seller_reference' && id) return numistaReference(id, 'seller_reference');
  return id ? numistaReference(id, 'backend_match') : null;
}
export function numistaVisualCandidates(value: unknown): NumistaVisualCandidate[] {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return Array.isArray(row.candidates) ? row.candidates.flatMap((entry: unknown) => {
    if (!entry || typeof entry !== 'object') return [];
    const candidate = entry as Record<string, unknown>, id = parseNumistaNumber(candidate.typeId);
    if (!id || typeof candidate.title !== 'string' || typeof candidate.rank !== 'number') return [];
    return [{ ...numistaReference(id, 'backend_match'), title: candidate.title, rank: candidate.rank }];
  }) : [];
}
export async function prepareNumistaFaces(prepared: PreparedScanPhotos): Promise<NumistaFace[]> {
  const faces = ['obverse', 'reverse'].flatMap(slot => { const index = prepared.slots.indexOf(slot); return index < 0 ? [] : [{ url: prepared.images[index], label: prepared.imageLabels[index] }]; });
  return Promise.all(faces.map(async face => {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('The original coin face could not be prepared for Numista.')); image.src = face.url; });
    const image_data = face.url.replace(/^data:image\/jpeg;base64,/i, '');
    if (image_data.length > 800000 || Math.max(image.naturalWidth, image.naturalHeight) > 1024) throw new Error('Numista requires original coin-face analysis copies no larger than 1024 pixels.');
    return { mime_type: 'image/jpeg' as const, image_data, width: image.naturalWidth, height: image.naturalHeight, label: face.label.slice(0, 120) };
  }));
}

/** Fields read by swish-identify's existing direct /types/{id} Numista lookup. */
export function numistaIdentifyKnownAttributes(supplied: unknown): Record<string, unknown> {
  const id = parseNumistaNumber(supplied);
  if (!id) return {};
  const reference = numistaReference(id, 'seller_reference');
  return {
    catalogueNumber: reference.numistaN,
    numistaN: reference.numistaN,
    numista_n: reference.numistaN,
    numistaTypeId: reference.typeId,
    numistaReference: reference.url,
    numistaUrl: reference.url,
    customNotes: `Seller-supplied Numista ${reference.numistaN}: ${reference.url}. Resolve the exact catalogue record and compare both coin faces and measurements; this is not physical authentication.`,
  };
}
function numistaReviewRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function numistaReviewText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
function numistaReviewLines(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim())) : [];
}
/** A seller reference anchors review; visual AI remains evidence, never a competing selected identity. */
export function numistaAnchoredReview(
  response: unknown, visualCandidates: Record<string, unknown>[], supplied: unknown,
): {
  candidates: Record<string, unknown>[];
  reference: ReturnType<typeof numistaReference> | null;
  catalogueRetrieved: boolean;
  visualConflict: boolean;
  visualCandidate: Record<string, unknown> | null;
} {
  const id = parseNumistaNumber(supplied);
  const visualCandidate = visualCandidates[0] ?? null;
  if (!id) return { candidates: visualCandidates, reference: null, catalogueRetrieved: false, visualConflict: false, visualCandidate };
  const reference = numistaReference(id, 'seller_reference');
  const root = numistaReviewRecord(response);
  const wrapped = numistaReviewRecord(root.result);
  const identification = numistaReviewRecord(root.identification ?? wrapped.identification);
  const verification = numistaReviewRecord(root.numistaVerification ?? wrapped.numistaVerification ?? identification.numistaVerification);
  const factors = numistaReviewLines(verification.matchFactors);
  const catalogueRetrieved = parseNumistaNumber(verification.typeId ?? verification.numistaN ?? verification.numistaId) === id &&
    factors.some(factor => factor.includes(`Exact user-supplied catalogue reference ${reference.numistaN} retrieved directly from Numista API`));
  const catalogueTitle = catalogueRetrieved ? numistaReviewText(verification.title) : '';
  const visualTitle = numistaReviewText(visualCandidate?.title ?? visualCandidate?.name ?? visualCandidate?.canonicalTitle);
  const comparable = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const catalogueComparable = comparable(catalogueTitle), visualComparable = comparable(visualTitle);
  const contradictions = catalogueRetrieved ? numistaReviewLines(verification.contradictions) : [];
  const visualConflict = Boolean(catalogueComparable && visualComparable &&
    !catalogueComparable.includes(visualComparable) && !visualComparable.includes(catalogueComparable)) || contradictions.length > 0;
  const catalogueFields: Record<string, unknown> = {};
  if (catalogueTitle) {
    for (const [field, key] of Object.entries({ denomination: 'denomination', country: 'country', metal: 'composition', issuer: 'issuer', mint: 'mint', obverseDescription: 'obverse', reverseDescription: 'reverse' })) {
      const value = numistaReviewText(verification[key]);
      if (value) catalogueFields[field] = value;
    }
  }
  const warning = 'Visual evidence may not match the seller-supplied Numista reference — compare both coin faces, weight and diameter before confirming.';
  const candidate: Record<string, unknown> = {
    ...catalogueFields,
    title: catalogueTitle || `Seller-supplied Numista reference ${reference.numistaN} — catalogue details not retrieved`,
    reference: reference.numistaN,
    numista_url: reference.url,
    catalogue_url: reference.url,
    numista_type_id: reference.typeId,
    _numista_reference_source: reference.source,
    // A retrieved catalogue type is not proof that the physical coin matches it.
    confidence: 0.2,
    evidence: [catalogueTitle ? `Exact Numista catalogue record ${reference.numistaN} retrieved for comparison; physical identity remains unverified.` : `Seller supplied ${reference.numistaN}; catalogue details could not be retrieved or verified.`],
    contradictions,
    warnings: visualConflict ? [warning] : [],
    missingInformation: ['Physical verification still required: compare obverse, reverse, measured weight and diameter.'],
  };
  return { candidates: [candidate], reference, catalogueRetrieved: Boolean(catalogueTitle), visualConflict, visualCandidate };
}
