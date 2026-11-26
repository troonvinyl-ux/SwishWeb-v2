import { captureRecord, captureText } from '@/lib/captureRequest';
import { collectorTextIdentity, prefillCoinListingFacts } from '@/lib/coinListingFacts';
import type { CollectorEvidence } from '@/types/rapidCoin';
const aliases: Record<string, string> = { country: 'country', issuingcountry: 'country', issuingauthority: 'country', ruler: 'ruler', monarch: 'ruler', date: 'date', year: 'date', issuedate: 'date', coindate: 'date', daterange: 'date', denomination: 'denomination', mint: 'mint', metal: 'metal', composition: 'metal', material: 'metal' };
/** Collector words are research context, never seller-confirmed identity or actual measurements. */
export function collectorResearchFields(evidence: CollectorEvidence): Record<string, string> {
  const fields: Record<string, string> = { ...collectorTextIdentity(evidence.transcription) };
  const structured = new Set<string>();
  for (const field of evidence.fields) {
    const key = aliases[field.name.toLowerCase().replace(/[^a-z]/g, '')];
    if (key && field.source === 'collector' && field.value.trim() && !structured.has(key)) { fields[key] = field.value.trim(); structured.add(key); }
  }
  return fields;
}
export function collectorResearchTitle(evidence: CollectorEvidence): string {
  const fields = collectorResearchFields(evidence);
  const identity = [fields.country, fields.denomination, fields.date, fields.ruler].filter(Boolean).join(' ');
  return identity ? `Collector-labelled ${identity} coin`.slice(0, 80) : '';
}
/** Preserve the visible candidate and uncertainty; only replace an otherwise unidentified object title. */
export function attachCollectorEvidence(identification: Record<string, unknown>, evidence: CollectorEvidence): Record<string, unknown> {
  const attrs = captureRecord(identification.attributes), title = captureText(identification.canonicalTitle ?? identification.title);
  const lead = collectorResearchTitle(evidence);
  const generic = !title || /^(?:(?:unknown|unidentified|unresolved|worn|ancient|collectible|copper|bronze|silver)\s+)*(?:coin|object)(?:\s*\d+)?[.!?]?$/i.test(title);
  return { ...identification, ...(generic && lead ? { canonicalTitle: lead } : {}), attributes: prefillCoinListingFacts({ ...attrs,
    collector_envelope: evidence, _rapid_coin_evidence: evidence, _collector_research_fields: collectorResearchFields(evidence), _collector_research_title: lead,
    _collector_provenance: 'Envelope transcription and collector attribution; physical identity, measurements and authenticity remain unverified.',
  }, title) };
}
