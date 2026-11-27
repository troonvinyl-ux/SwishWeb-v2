import { captureRecord } from '@/lib/captureRequest';
/** Transport adapter only: reuse the existing authenticated swish-identify contract. */
export const COIN_IDENTIFICATION_REQUEST_VERSION = 'short-context-packet-2026-11-27';
export const COIN_ACQUISITION_CONTEXT = 'Coin Flipper: identify the same physical coin using both faces and any accompanying collector packet. Handwriting is research evidence, not authentication.';
export const ENVELOPE_ACQUISITION_CONTEXT = 'Coin Flipper: reread the saved collector envelope first, then compare both faces of the same coin. Retain literal handwriting as collector evidence.';
/** Detailed instructions belong in knownAttributes.customNotes, not acquisitionContext. */
export function coinIdentificationRequest(body: Record<string, unknown>): Record<string, unknown> {
  if (typeof body.acquisitionContext !== 'string' || body.acquisitionContext.length > 500) throw new Error('Coin request context must be a short workflow label. Your capture is retained.');
  const known = captureRecord(body.knownAttributes);
  // Match SWISH shared/identificationPolicy.ts; do not silently truncate seller notes.
  if (new TextEncoder().encode(JSON.stringify(known)).byteLength > 30000) throw new Error('Known item details exceed SWISH’s 30 KB limit. Shorten seller notes and retry the same capture; original notes and photos are retained.');
  const labels = body.imageLabels;
  if (Array.isArray(labels) && labels.some(label => typeof label !== 'string' || label.length > 120)) throw new Error('Coin photo labels must be at most 120 characters. Originals are retained.');
  return body;
}
