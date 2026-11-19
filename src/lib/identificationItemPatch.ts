import { asRecord } from '@/lib/itemPhotos';
import { IDENTIFICATION_FIELDS, identificationText } from '@/lib/identificationFields';
import { normalizeIdentification, identificationLines } from '@/lib/identificationResult';
/** Only reviewed identification is changed. Measurement, financial and presentation fields are never written. */
export function identificationItemPatch(item: Record<string, unknown>, suggestion: Record<string, unknown>, reviewedAt: string): Record<string, unknown> {
  const candidate = normalizeIdentification(suggestion), attrs = asRecord(item.attributes);
  const attributes: Record<string, unknown> = { ...attrs };
  const protectedKey = (key: string) => key.startsWith('_') || /^(source_scan|location|storage|supplied_|weight|diameter|dimensions|valuation|market_|expected_|acquired_|sold_|cost|price|sale_)/i.test(key);
  for (const [key, value] of Object.entries(asRecord(candidate.attributes))) {
    if (!protectedKey(key) && value != null && value !== '' && (typeof value !== 'string' || identificationText(value))) attributes[key] = value;
  }
  const updates: Record<string, unknown> = {};
  for (const field of IDENTIFICATION_FIELDS) {
    const text = identificationText(candidate[field.key]);
    if (!text) continue;
    attributes[field.key] = text;
    if (field.column) updates[field.column] = text;
  }
  const reviewed = Object.fromEntries(Object.entries(candidate).filter(([key]) => key !== '_itemUpdatedAt'));
  attributes.source_scan = { ...asRecord(attrs.source_scan), confirmed_candidate: reviewed, confirmed_at: reviewedAt };
  updates.attributes = attributes;
  if (typeof candidate.confidence === 'number' && Number.isFinite(candidate.confidence) && candidate.confidence >= 0 && candidate.confidence <= 1) updates.identification_confidence = candidate.confidence;
  const warnings = [...new Set([...identificationLines(item.warnings), ...identificationLines(candidate.warnings), ...identificationLines(candidate.contradictions)])];
  if (warnings.length) updates.warnings = warnings;
  return updates;
}
