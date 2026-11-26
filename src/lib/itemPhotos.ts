export interface ItemPhoto { original: string; presentation: string; prepared: boolean; }
export const STUDIO_VERSION = 'backgrounderase-3.0.0';
export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function photoUrl(value: unknown): string | null {
  const object = asRecord(value);
  const candidate = typeof value === 'string' ? value : object.url ?? object.publicUrl ?? object.public_url ?? object.src ?? object.uri;
  if (typeof candidate !== 'string') return null;
  const uri = candidate.trim();
  return /^https:\/\/\S+$/i.test(uri) ? uri : null;
}
/** Use only the app's persisted, fidelity-checked BackgroundErase presentations. */
export function usableStudio(value: unknown): boolean {
  const result = asRecord(value), quality = asRecord(result.quality);
  const professional = result.presentationVersion === 'coin-snap-1600-v1';
  return result.version === STUDIO_VERSION && result.status === 'ready' && !!photoUrl(result.enhancedUri)
    && quality.sourcePixelsOnly === true && quality.fidelityPassed === true
    && (!professional || quality.pairPassed === true && quality.scaleMatched === true && quality.backgroundWhite === true && quality.colourShiftBounded === true && quality.clippingIntroduced === false && quality.outputWidth === 1600 && quality.outputHeight === 1600);
}
export function itemPhotos(item: Record<string, unknown> | null | undefined): ItemPhoto[] {
  if (!item) return [];
  const attrs = asRecord(item.attributes);
  const studios = Object.values(asRecord(attrs._smart_studio_images)).map(asRecord);
  const references = Object.values(asRecord(attrs._coin_reference_images));
  const derivatives = new Set([...references, ...studios.flatMap(value => [value.enhancedUri, value.maskUri])]);
  const media = [...(Array.isArray(item.media) ? item.media : []), ...(Array.isArray(item.images) ? item.images : []), item.image_url, item.image, item.image_url_1, item.image_url_2];
  const originals = [...new Set(media.map(photoUrl).filter((url): url is string => !!url))]
    .filter(url => !derivatives.has(url) && !/\/(?:studio|references)\//i.test(url.split('?')[0]));
  return originals.map(original => {
    const candidates = studios.filter(value => value.originalUri === original && usableStudio(value));
    const studio = candidates.find(value => value.presentationVersion === 'coin-snap-1600-v1') ?? candidates[0];
    return { original, presentation: studio ? String(studio.enhancedUri) : original, prepared: !!studio };
  });
}
export function preferredItemPhoto(item: Record<string, unknown> | null | undefined): string | null {
  return itemPhotos(item)[0]?.presentation ?? null;
}
export function availableItemPhotos(item: Record<string, unknown> | null | undefined): string[] {
  return [...new Set(itemPhotos(item).flatMap(photo => photo.prepared ? [photo.presentation, photo.original] : [photo.original]))];
}
