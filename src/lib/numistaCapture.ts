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
