import { asRecord } from '@/lib/itemPhotos';
import { IDENTIFICATION_FIELDS, identificationText } from '@/lib/identificationFields';
export function identificationLines(value: unknown): string[] {
  return [...new Set((Array.isArray(value) ? value : [value]).filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim())).map(entry => entry.trim()))];
}
/** Interpret the native structured result without deriving a ruler, date or mint from its title. */
export function normalizeIdentification(value: unknown): Record<string, unknown> {
  const raw = asRecord(value);
  const confirmed = asRecord(raw.attributesConfirmed), inferred = asRecord(raw.attributesInferred);
  const sources = [confirmed, raw, asRecord(raw.attributes), asRecord(raw.coinFields), asRecord(raw.medalFields), inferred, asRecord(raw.observedCharacteristics)];
  const normalized: Record<string, unknown> = { ...raw };
  const attributes: Record<string, unknown> = {};
  for (const source of [inferred, asRecord(raw.attributes), confirmed]) {
    for (const [key, entry] of Object.entries(source)) if (entry != null && entry !== '') attributes[key] = entry;
  }
  normalized.attributes = attributes;
  for (const field of IDENTIFICATION_FIELDS) {
    const text = sources.flatMap(source => field.aliases.map(key => identificationText(source[key]))).find(entry => entry !== undefined);
    if (text !== undefined) normalized[field.key] = text;
  }
  normalized.title = identificationText(normalized.title) ?? identificationText(normalized.denomination);
  normalized.evidence = identificationLines(raw.evidenceSupporting ?? raw.evidence);
  normalized.contradictions = identificationLines(raw.evidenceContradictory ?? raw.contradictions);
  normalized.warnings = identificationLines(raw.warnings);
  normalized.missingInformation = identificationLines(raw.missingInformation ?? raw.missing_information);
  if (!identificationText(normalized.description)) {
    const observations = IDENTIFICATION_FIELDS.filter(field => ['obverseDescription', 'reverseDescription', 'legendFragment'].includes(field.key))
      .flatMap(field => identificationText(normalized[field.key]) ? [`${field.label}: ${normalized[field.key]}`] : []);
    if (observations.length) normalized.description = observations.join('\n');
  }
  return normalized;
}
/** Supports native, wrapped, and legacy ranked-candidate responses. Explicit failures never become candidates. */
export function identificationCandidates(value: unknown): Record<string, unknown>[] {
  const response = asRecord(value), wrapper = asRecord(response.result);
  if (response.success === false || response.unable_to_identify === true || response.error || wrapper.success === false || wrapper.unable_to_identify === true) return [];
  const body = Object.keys(wrapper).length ? wrapper : response;
  const ranked = Array.isArray(body.candidates) && body.candidates.length ? body.candidates : null;
  const entries = ranked ?? [body.identification ?? body];
  return entries.map(normalizeIdentification).filter(entry => Boolean(identificationText(entry.title)));
}
export function savedIdentification(item: Record<string, unknown> | null): Record<string, unknown> {
  const attrs = asRecord(item?.attributes), scan = asRecord(attrs.source_scan);
  const stored = asRecord(scan.confirmed_candidate);
  const normalized = normalizeIdentification({ ...attrs, ...asRecord(item?.identification_data), ...stored });
  const title = identificationText(item?.canonical_title) ?? identificationText(normalizeIdentification(stored).title) ?? identificationText(normalized.title);
  return { ...normalized, canonicalTitle: title, title };
}
