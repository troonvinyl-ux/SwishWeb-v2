import { COIN_FACT_ALIASES, coinFieldKey, coinRecord, coinScalar, literalCollectorIdentity, singleCoinYear } from '@/lib/coinFactNormalization';
/** Retain literal issue-year candidates separately from ruler reign ranges and ambiguous handwriting. */
export function collectorCoinFields(attributes: Record<string, unknown>): Record<string, unknown> {
  const envelope = coinRecord(attributes.collector_envelope ?? attributes._rapid_coin_evidence);
  const transcription = coinScalar(envelope.transcription);
  const literal = literalCollectorIdentity(transcription);
  // AR may share a line with a condition annotation, but it remains collector notation, never tested metal.
  if (!literal.metal && transcription.split(/\r?\n/).some(line => /^\s*AR\.?(?:\s|$)/i.test(line))) literal.metal = 'Silver';
  const fields: Record<string, unknown> = { ...literal, ...coinRecord(attributes._collector_research_fields) };
  const candidates: string[] = [];
  const raw = envelope.fields;
  const entries = Array.isArray(raw) ? raw : Object.entries(coinRecord(raw)).map(([name, value]) => ({ ...coinRecord(value), name, value: coinRecord(value).value ?? value, source: coinRecord(value).source ?? 'collector' }));
  for (const entry of entries) {
    const row = coinRecord(entry), key = coinFieldKey(coinScalar(row.name)), value = coinScalar(row.value);
    if (!key || !value || row.source && row.source !== 'collector') continue;
    if (key === 'year') candidates.push(value);
    else fields[key] = value;
  }
  const dated = [...candidates, ...COIN_FACT_ALIASES.year.map(key => coinScalar(fields[key])), coinScalar(literal.date)].map(singleCoinYear).filter(Boolean);
  const dates = [...new Set(dated)];
  if (dates.length === 1) fields.year = dates[0];
  else if (dates.length > 1) { fields.year = ''; fields.date = ''; }
  if (!fields.composition && fields.metal) fields.composition = fields.metal;
  return fields;
}
