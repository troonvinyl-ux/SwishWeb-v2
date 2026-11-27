import { coinRecord, coinScalar } from '@/lib/coinFactNormalization';
import type { CoinEvidenceField, CollectorEvidence } from '@/types/rapidCoin';
const PACKET_KEYS = ['attribution', 'ruler', 'denomination', 'mint', 'year', 'catalogue_number', 'weight_g', 'diameter_mm'] as const;
const FIELD_NAMES: Record<string, string> = { year: 'date', catalogue_number: 'catalogue_references', weight_g: 'weight', diameter_mm: 'diameter' };
const text = (value: unknown, max = 240) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const folded = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();
/** Adapt SWISH shared/coinPacket.ts to the web evidence view, retaining its quote/unit validation.
 * No OCR/provider call. Packet claims never become measured or visually confirmed facts.
 */
export function coinPacketEvidence(value: unknown): CollectorEvidence | null {
  const raw = coinRecord(value), transcription = text(raw.transcript, 2000);
  if (!transcription) return null;
  const entries = coinRecord(raw.fields), fields: CoinEvidenceField[] = [];
  for (const key of PACKET_KEYS) {
    const row = coinRecord(entries[key]), value = text(row.value), quote = text(row.quote);
    if (!coinScalar(value) || !quote || !folded(transcription).includes(folded(quote))) continue;
    let literal = value;
    if (key === 'weight_g' || key === 'diameter_mm') {
      const unit = key === 'weight_g' ? /(\d+(?:[.,]\d+)?)\s*(?:g\b|grams?\b)/i : /(\d+(?:[.,]\d+)?)\s*mm\b/i;
      const match = quote.match(unit), amount = Number(value.replace(',', '.'));
      if (!match || !Number.isFinite(amount) || amount <= 0 || Number(match[1].replace(',', '.')) !== amount) continue;
      literal = String(amount);
    } else if (!folded(quote).includes(folded(value))) continue;
    const uncertain = row.uncertain === true || quote.includes('?') || literal.includes('?');
    fields.push({ name: FIELD_NAMES[key] || key, value: uncertain && !literal.includes('?') ? `${literal} ?` : literal,
      source: 'collector', note: `Packet inscription: ${quote}.${uncertain ? ' OCR reading uncertain; seller review required.' : ''} Not independently verified.` });
  }
  const discrepancies = Array.isArray(raw.limitations) ? raw.limitations.filter((entry): entry is string => typeof entry === 'string').map(entry => text(entry)).filter(Boolean).slice(0, 8) : [];
  return { transcription, transcriptionAvailable: true, fields, discrepancies };
}
