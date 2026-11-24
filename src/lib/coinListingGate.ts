import { numistaReference, parseNumistaNumber } from '@/lib/numistaCapture';
import type { CapturePhoto } from '@/types/capture';

export interface CoinDraftReadiness {
  ready: boolean;
  message: string | null;
  typeId: number | null;
}

function positiveMeasurement(value: string | undefined): boolean {
  const measured = Number(value);
  return Number.isFinite(measured) && measured > 0;
}

/**
 * A coin draft is only useful when it is anchored to a seller-supplied Numista
 * entry and the physical coin has the two comparison measurements. This gate is
 * used both by the screen and immediately before the shared draft RPC, so a UI
 * change cannot create an unreferenced coin listing.
 */
export function coinDraftReadiness(answers: Record<string, string>, photos: CapturePhoto[]): CoinDraftReadiness {
  const typeId = parseNumistaNumber(answers.numista_number);
  if (!typeId) return { ready: false, typeId: null, message: 'Enter a valid Numista N# before pulling a coin eBay draft.' };
  const faces = new Set(photos.map(photo => photo.slotId));
  if (!faces.has('obverse') || !faces.has('reverse')) return { ready: false, typeId, message: 'Photograph both the obverse and reverse before pulling a coin eBay draft.' };
  if (!positiveMeasurement(answers.weight)) return { ready: false, typeId, message: 'Enter the actual coin weight in grams before pulling a coin eBay draft.' };
  if (!positiveMeasurement(answers.diameter)) return { ready: false, typeId, message: 'Enter the actual coin diameter in millimetres before pulling a coin eBay draft.' };
  return { ready: true, typeId, message: null };
}

export function assertCoinDraftReady(answers: Record<string, string>, photos: CapturePhoto[]): number {
  const readiness = coinDraftReadiness(answers, photos);
  if (!readiness.ready || !readiness.typeId) throw new Error(readiness.message || 'Coin listing evidence is incomplete.');
  return readiness.typeId;
}

/** Store one canonical seller-supplied reference rather than a free-text variant. */
export function canonicalCoinReferenceAnswers(answers: Record<string, string>, typeId: number): Record<string, string> {
  const reference = numistaReference(typeId, 'seller_reference');
  return {
    ...answers,
    numista_number: reference.numistaN,
    numista_n: reference.numistaN,
    numista_type_id: String(reference.typeId),
    numista_reference: reference.url,
    _numista_reference_source: reference.source,
  };
}
