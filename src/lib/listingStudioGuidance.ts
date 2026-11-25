import { SCAN_PROFILES } from '@/lib/sharedScanFlow';
import { normaliseNicheId, type SwishNicheId } from '@/lib/niche';
import { captureRecord, captureStrings, captureText } from '@/lib/captureRequest';
import type { CaptureSlot } from '@/types/capture';
import type { StudioObservation, StudioRetainedPhoto } from '@/types/listingStudio';
export function studioSlots(niche: SwishNicheId | null): CaptureSlot[] {
  const profile = niche ? SCAN_PROFILES[niche] : null;
  return profile ? profile.evidence.map(slot => ({ ...slot, description: slot.label, required: false })) : [{ id: 'item', label: 'Whole item', description: 'Photograph the object you are selling, not only its packaging artwork.', required: false }];
}
export function nextStudioSlot(niche: SwishNicheId | null, photos: StudioRetainedPhoto[], selected = ''): CaptureSlot {
  const slots = studioSlots(niche), ids = new Set(photos.map(photo => photo.slotId));
  return slots.find(slot => slot.id === selected) || (selected ? { id: selected, label: photos.find(photo => photo.slotId === selected)?.label || 'Detail', description: 'Retake this view', required: false } : null) || slots.find(slot => !ids.has(slot.id)) || { id: `detail_${photos.length + 1}`, label: 'Additional detail', description: 'Show an unresolved identifier or a visible fault.', required: false };
}
export function parseStudioObservation(value: unknown): StudioObservation {
  const data = captureRecord(value), result = captureRecord(data.identification ?? captureRecord(data.result).identification ?? data.result ?? data);
  return { title: captureText(result.canonicalTitle ?? result.title), next: captureStrings(result.missingInformation)[0] || '', warnings: captureStrings(result.warnings), result };
}
/** A recommendation is display-only: never grants access or changes inventory ownership. */
export function studioRecommendedNiche(result: Record<string, unknown>): SwishNicheId | null { return normaliseNicheId(result.nicheId ?? result.niche_id ?? result.specialistId); }
export function studioInstruction(niche: SwishNicheId | null, photos: StudioRetainedPhoto[], slot: CaptureSlot, observation: StudioObservation | null): string {
  if (!photos.length) return niche === 'coins' ? 'Start with the whole obverse of your coin.' : niche === 'tunes_flip' ? 'Start with the entire front sleeve.' : 'Start with the whole item.';
  // Existing shared role evidence takes precedence over a repeated or unrelated model request.
  if (niche && studioSlots(niche).some(value => !photos.some(photo => photo.slotId === value.id))) return `Next: ${slot.label.toLowerCase()}.`;
  return observation?.next ? `Still uncertain: ${observation.next.slice(0, 160)}` : 'Add a useful detail, or tap Done to review.';
}
