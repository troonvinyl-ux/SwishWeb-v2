import { COIN_FACT_KEYS, COIN_FACT_ALIASES, coinRecord, coinScalar, normalizeCoinCountry, singleCoinYear, literalCollectorIdentity, type CoinFactKey } from '@/lib/coinFactNormalization';
import { collectorCoinFields } from '@/lib/collectorCoinFields';
/** Editable listing proposals. Recorded AI attributes are not physical confirmation. */
export interface CoinListingFact { value: string; source: 'recorded' | 'visual' | 'collector' | 'title'; }
export type CoinListingFacts = Partial<Record<CoinFactKey, CoinListingFact>>;
export const legibleCoinYear = singleCoinYear;
export const collectorTextIdentity = literalCollectorIdentity;
export function coinListingFacts(attributes: Record<string, unknown>, title = ''): CoinListingFacts {
  const collector = collectorCoinFields(attributes), observed = coinRecord(attributes.observedCharacteristics);
  const reread = coinRecord(attributes._coin_reread_fields);
  const sources: Array<{ values: Record<string, unknown>; source: CoinListingFact['source'] }> = [
    { values: coinRecord(attributes._coin_specific_overrides), source: 'recorded' },
    { values: observed, source: 'visual' },
    { values: coinRecord(attributes.attributesConfirmed), source: 'recorded' },
    { values: attributes, source: 'recorded' }, { values: reread, source: 'recorded' },
    { values: coinRecord(attributes.coinFields), source: 'recorded' },
    { values: coinRecord(attributes.attributesInferred), source: 'recorded' }, { values: collector, source: 'collector' },
  ];
  const facts: CoinListingFacts = {}, retained = coinRecord(attributes._coin_listing_prefill);
  for (const key of COIN_FACT_KEYS) {
    for (const source of sources) {
      const values = COIN_FACT_ALIASES[key].map(alias => coinScalar(source.values[alias])).filter(Boolean);
      const raw = key === 'year' ? values.map(singleCoinYear).find(Boolean) || '' : values[0] || '';
      const value = key === 'country' ? normalizeCoinCountry(raw) : raw;
      if (!value) continue;
      const previous = coinRecord(retained[key]);
      // A stale machine projection must not mask a newly reread collector label. Actual seller specifics win above.
      const collectorRaw = COIN_FACT_ALIASES[key].map(alias => coinScalar(collector[alias])).find(Boolean) || '';
      const collectorValue = key === 'year' ? singleCoinYear(collectorRaw) : key === 'country' ? normalizeCoinCountry(collectorRaw) : collectorRaw;
      if (source.values === attributes && previous.value === value && ['collector', 'title'].includes(String(previous.source)) && collectorValue && collectorValue !== value) continue;
      const provenance = source.source === 'recorded' && previous.value === value && ['recorded', 'visual', 'collector', 'title'].includes(String(previous.source))
        ? previous.source as CoinListingFact['source'] : source.source;
      const packetRecorded = source.values === attributes && COIN_FACT_ALIASES[key].some(alias => attributes[`_packet_${alias}`] === true);
      facts[key] = { value, source: packetRecorded ? 'collector' : provenance }; break;
    }
  }
  const titleFields = literalCollectorIdentity(title);
  for (const key of COIN_FACT_KEYS) {
    const raw = coinScalar(titleFields[key] ?? titleFields[key === 'year' ? 'date' : key === 'composition' ? 'metal' : key]);
    const value = key === 'year' ? singleCoinYear(raw) : raw;
    if (!facts[key] && value) facts[key] = { value, source: 'title' };
  }
  return facts;
}
export function coinListingFactPatch(attributes: Record<string, unknown>, title = ''): Record<string, unknown> {
  const facts = coinListingFacts(attributes, title);
  return { ...Object.fromEntries(Object.entries(facts).map(([key, fact]) => [key, fact.value])), _coin_listing_prefill: facts };
}
export function prefillCoinListingFacts(attributes: Record<string, unknown>, title = ''): Record<string, unknown> {
  return { ...attributes, ...coinListingFactPatch(attributes, title) };
}
